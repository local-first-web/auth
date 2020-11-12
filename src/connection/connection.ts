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
  ConnectionStateSchema,
  SendFunction,
} from '/connection/types'
import * as identity from '/identity'
import { KeyType, randomKey } from '/keyset'
import {
  AcceptIdentityMessage,
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  HelloMessage,
  ProveIdentityMessage,
} from '/message'
import { Team } from '/team'
import * as invitations from '/invitation'

const { MEMBER } = KeyType

// TODO: This is not robust against unexpected variations in the timing of message delivery, or the
// order in which messages are delivered. The solution is probably to build in a queue of received
// messages; order them correctly (presumably using an index or timestamp included in every
// message); and only deliver them to the machine when it is ready.
//
// See https://github.com/davidkpiano/xstate/discussions/1627

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
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

  public start = () => {
    // define state machine
    const machine = createMachine<ConnectionContext, ConnectionMessage>(connectionMachine, {
      actions: this.actions,
      guards: this.guards,
    }).withContext(this.context)

    // instantiate the machine and start the instance
    this.instance = interpret(machine).start()
    return this
  }

  get state() {
    return this.instance.state.value
  }

  public deliver(incomingMessage: ConnectionMessage) {
    // console.log(`deliver to ${this.context.user.userName}`, incomingMessage)
    this.instance.send(incomingMessage)
  }

  private readonly actions: Record<string, Action> = {
    sendHello: context => {
      // log('sendHello', context)

      // claim our identity
      const identityClaim = { type: MEMBER, name: context.user.userName }
      // if we're not a member yet, attach our proof of invitation
      const proofOfInvitation =
        context.invitationSecretKey !== undefined
          ? invitations.acceptMemberInvitation(
              context.invitationSecretKey,
              redactUser(context.user)
            )
          : undefined
      this.sendMessage({
        type: 'HELLO',
        payload: { identityClaim, proofOfInvitation },
      })
    },

    receiveHello: (context, message) => {
      // log('receiveHello', context)

      const helloMessage = message as HelloMessage
      const { payload } = helloMessage
      // store their identity claim for later reference
      context.theirIdentityClaim = payload.identityClaim
      // if they're presenting proof of invitation, store that also
      if (payload.proofOfInvitation !== undefined) {
        context.theyHaveInvitation = true
        context.theirProofOfInvitation = payload.proofOfInvitation
      } else {
        context.theyHaveInvitation = false
      }
    },

    failNeitherIsMember: () => this.fail(`Can't connect; neither one of us is a member`),

    acceptInvitation: context => {
      // welcome them by sending the team's signature chain, so they can reconstruct team membership state
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
      // TODO: add current device?
    },

    claimIdentity: context => {},

    challengeIdentity: context => {
      // log('challengeIdentity', context)

      const identityClaim = context.theirIdentityClaim!

      // generate challenge
      const challengeMessage = identity.challenge(identityClaim)

      // store challenge in context, to check against later
      context.challenge = challengeMessage

      this.sendMessage(challengeMessage)
    },

    proveIdentity: (context, event) => {
      // log('proveIdentity', context)

      const challenge = event as ChallengeIdentityMessage

      // generate proof
      const proofMessage = identity.prove(challenge, context.user.keys)

      this.sendMessage(proofMessage)
    },

    acceptIdentity: context => {
      // log('acceptIdentity', context)

      // generate a seed that will be combined with the peer's seed to create a symmetric encryption key
      const seed = randomKey()
      // save it in context so we can retrieve it later
      context.seed = seed

      const peer = context.team!.members(context.theirIdentityClaim!.name)
      context.peer = peer
      const peerKeys = peer.keys
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
    iHaveInvitation: context => {
      // log('iHaveInvitation', context)
      return context.invitationSecretKey !== undefined
    },

    theyHaveInvitation: context => {
      // log('theyHaveInvitation', context)

      return context.theyHaveInvitation === true
    },

    bothHaveInvitation: context => {
      // log('bothHaveInvitation', context)
      return context.invitationSecretKey !== undefined && context.theyHaveInvitation === true
    },

    invitationProofIsValid: (context, event) => {
      // log('invitationProofIsValid', context)
      const proofOfInvitation = context.theirProofOfInvitation!
      try {
        context.team!.admit(proofOfInvitation)
      } catch (e) {
        return false
      }
      return true
    },

    identityIsKnown: context => {
      // log('identityIsKnown', context)
      const identityClaim = context.theirIdentityClaim!
      const userName = identityClaim.name
      return context.team!.has(userName)
    },

    identityProofIsValid: (context, event) => {
      // log('identityProofIsValid', context)
      const { team, challenge } = context
      const proofMessage = event as ProveIdentityMessage
      const userName = challenge!.payload.name!
      const publicKeys = team!.members(userName).keys
      const validation = identity.verify(challenge!, proofMessage, publicKeys)
      return validation.isValid
    },
  }
}

// function log(label: string, context: ConnectionContext) {
// console.log(`${context.user.userName}: ${label} ${Object.keys(context)}`)
// }
