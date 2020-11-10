import { redact as redactUser } from '/user'
import { asymmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import { createMachine, interpret, Interpreter } from 'xstate'
import { connectionMachine } from '/connection/connectionMachine'
import { deriveSharedKey } from '/connection/deriveSharedKey'
import {
  Action,
  Condition,
  ConnectionContext,
  ConnectionParams,
  ConnectionState,
  ConnectionStateSchema,
  MemberConnectionContext,
  MemberConnectionState,
  SendFunction,
} from '/connection/types'
import * as identity from '/identity'
import { KeyType, randomKey } from '/keyset'
import {
  AcceptIdentityMessage,
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ClaimIdentityMessage,
  ConnectionMessage,
  HelloMessage,
  ProveIdentityMessage,
  ProveInvitationMessage,
} from '/message'
import { Team } from '/team'
import * as invitations from '/invitation'

const { MEMBER } = KeyType

/**
 * A `ConnectionService` wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol.  The XState configuration is in `machineConfig`.
 */
export class ConnectionService extends EventEmitter {
  private sendMessage: SendFunction

  public instance: Interpreter<ConnectionContext, ConnectionStateSchema, ConnectionMessage>
  public context: ConnectionContext

  constructor({ sendMessage, context }: ConnectionParams) {
    super()
    this.sendMessage = sendMessage
    this.context = context
  }

  /**
   * @returns a running instance of an XState state machine
   */
  public start = () => {
    // define state machine
    const machine = createMachine<ConnectionContext, ConnectionMessage, ConnectionState>(
      connectionMachine,
      {
        actions: this.actions,
        guards: this.guards,
      }
    ).withContext(this.context)

    // instantiate the machine and start the instance
    this.instance = interpret(machine).start()
    return this.instance
  }

  get state() {
    return this.instance.state.value
  }

  // public connect = async () => {
  //   this.start()
  //   return new Promise((resolve, reject) => {
  //     this.on('connected', () => resolve(this))
  //     this.on('error', reject)
  //   })
  // }

  private actions: Record<string, Action> = {
    sendHello: (context, message) => {
      const iHaveInvitation = context.invitationSecretKey !== undefined
      const payload = iHaveInvitation ? 'I HAVE AN INVITATION' : 'I AM A MEMBER'
      const helloMessage = { type: 'HELLO', payload } as HelloMessage
      this.sendMessage(helloMessage)
    },

    receiveHello: (context, message) => {
      const helloMessage = message as HelloMessage
      const status = helloMessage.payload
      if (status === 'I HAVE AN INVITATION') context.theyHaveInvitation = true
      else context.theyHaveInvitation = false
    },

    failNeitherIsMember: () => this.fail('Neither one of us is a member'),

    proveInvitation: context => {
      const proofOfInvitation = invitations.acceptMemberInvitation(
        context.invitationSecretKey!,
        redactUser(context.user)
      )
      const proveInvitationMessage = {
        type: 'PROVE_INVITATION',
        payload: proofOfInvitation,
      } as ProveInvitationMessage

      this.sendMessage(proveInvitationMessage)
    },

    acceptInvitation: context => {
      // welcome them by sending the team's
      const chain = context.team!.save()
      const welcomeMessage: AcceptInvitationMessage = {
        type: 'ACCEPT_INVITATION',
        payload: { chain },
      }
      this.sendMessage(welcomeMessage)
    },

    rejectInvitation: () => this.fail('Invalid invitation'),

    joinTeam: (context, event) => {
      const welcomeMessage = event as AcceptInvitationMessage
      const { chain } = welcomeMessage.payload
      this.context.team = new Team({ source: chain, context: { user: context.user } })
      // add current device?
    },

    claimIdentity: context => {
      const { user } = context
      // generate claim
      const claimMessage = identity.claim({
        type: MEMBER,
        name: user.userName,
      }) as ClaimIdentityMessage

      this.sendMessage(claimMessage)
    },

    challengeIdentity: (context, event) => {
      const claimMessage = event as ClaimIdentityMessage

      // store peer on context
      context.peer = context.team!.members(claimMessage.payload.name)

      // generate challenge
      const challengeMessage = identity.challenge(claimMessage)

      // store challenge in context, to check against later
      context.challenge = challengeMessage

      this.sendMessage(challengeMessage)
    },

    proveIdentity: (context, event) => {
      const challenge = event as ChallengeIdentityMessage

      // generate proof
      const proofMessage = identity.prove(challenge, context.user.keys)

      this.sendMessage(proofMessage)
    },

    acceptIdentity: context => {
      // generate a seed that will be combined with the peer's seed to create a symmetric encryption key
      const seed = randomKey()
      // save it in context so we can retrieve it later
      context.seed = seed

      const peerKeys = context.peer!.keys
      const userKeys = context.user.keys
      const acceptanceMessage = identity.accept({ seed, peerKeys, userKeys })

      this.sendMessage(acceptanceMessage)
    },

    rejectIdentity: () => this.fail('Unable to confirm identity'),

    saveSeed: (context, event) => {
      // save seed
      const acceptanceMessage = event as AcceptIdentityMessage
      context.encryptedPeerSeed = acceptanceMessage.payload.encryptedSeed
    },

    onConnected: () => {
      this.emit('connected')
    },

    deriveSecretKey: context => {
      const userKeys = context.user.keys
      const peerKeys = context.peer!.keys

      // we saved our seed in context
      const userSeed = context.seed!
      // the peer's seed is in context but is encrypted; decrypt it
      const peerSeed = asymmetric.decrypt({
        cipher: context.encryptedPeerSeed!,
        senderPublicKey: peerKeys.encryption,
        recipientSecretKey: userKeys.encryption.secretKey,
      })

      context.secretKey = deriveSharedKey(userSeed, peerSeed)
    },
  }

  private fail = (message: string, payload?: any) => {
    this.sendMessage({ type: 'ERROR', payload: { message, payload } })
  }

  private readonly guards: Record<string, Condition> = {
    iHaveInvitation: context => context.invitationSecretKey !== undefined,

    theyHaveInvitation: context => context.theyHaveInvitation === true,

    bothHaveInvitation: (...args) =>
      this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args),

    invitationProofIsValid: (context, event) => {
      const proofMessage = event as ProveInvitationMessage
      const proofOfInvitation = proofMessage.payload
      try {
        context.team!.admit(proofOfInvitation)
      } catch (e) {
        return false
      }
      return true
    },

    identityIsKnown: (context, event) => {
      const claim = (event as ClaimIdentityMessage).payload
      const userName = claim.name
      return context.team!.has(userName)
    },

    identityProofIsValid: (context, event) => {
      const { team, challenge } = context
      const proofMessage = event as ProveIdentityMessage
      const userName = challenge!.payload.name!
      const publicKeys = team!.members(userName).keys
      const validation = identity.verify(challenge!, proofMessage, publicKeys)
      return validation.isValid
    },
  }
}
