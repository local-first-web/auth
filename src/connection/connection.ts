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
import * as invitations from '/invitation'
import { KeyType, randomKey } from '/keyset'
import {
  AcceptIdentityMessage,
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  ErrorMessage,
  ProveIdentityMessage,
} from '/message'
import { redactUser } from '/user'

const { MEMBER } = KeyType

// TODO: This is not robust against unexpected variations in the timing of message delivery, or in
// the order in which messages are delivered. The solution is probably to build in a queue of
// received messages; order them correctly (presumably using an index included in every message);
// and only deliver them to the machine when it is ready.
//
// See https://github.com/davidkpiano/xstate/discussions/1627

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol.  The XState configuration is in `machineConfig`.
 */
export class ConnectionService extends EventEmitter {
  private sendMessage: SendFunction

  public machine: Interpreter<ConnectionContext, ConnectionStateSchema, ConnectionMessage>
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
    this.machine = interpret(machine).start()
    return this
  }

  get state() {
    return this.machine.state.value
  }

  public deliver(incomingMessage: ConnectionMessage) {
    // console.log(`deliver to ${this.context.user.userName}`, incomingMessage)
    this.machine.send(incomingMessage)
  }

  private readonly actions: Record<string, Action> = {
    sendHello: context => {
      // log('ACTION sendHello', context)

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

    acceptInvitation: context => {
      // welcome them by sending the team's signature chain, so they can reconstruct team membership state
      const chain = context.team!.save()
      const welcomeMessage: AcceptInvitationMessage = {
        type: 'ACCEPT_INVITATION',
        payload: { chain },
      }
      this.sendMessage(welcomeMessage)
    },

    challengeIdentity: context => {
      // log('ACTION challengeIdentity', context)

      const identityClaim = context.theirIdentityClaim!

      // generate challenge
      context.challenge = identity.challenge(identityClaim)

      const challengeMessage: ChallengeIdentityMessage = {
        type: 'CHALLENGE_IDENTITY',
        payload: { challenge: context.challenge },
      }

      this.sendMessage(challengeMessage)
    },

    proveIdentity: (context, event) => {
      // log('ACTION proveIdentity', context)

      const { payload } = event as ChallengeIdentityMessage
      const { challenge } = payload

      // generate proof
      const proof = identity.prove(challenge, context.user.keys)
      const proofMessage: ProveIdentityMessage = {
        type: 'PROVE_IDENTITY',
        payload: { challenge, proof },
      }

      this.sendMessage(proofMessage)
    },

    acceptIdentity: context => {
      // log('ACTION acceptIdentity', context)

      // generate a seed that will be combined with the peer's seed to create a symmetric encryption key
      const seed = randomKey()
      // save it in context so we can retrieve it later
      context.seed = seed

      const peer = context.team!.members(context.theirIdentityClaim!.name)
      context.peer = peer
      const peerKeys = peer.keys
      const userKeys = context.user.keys
      const encryptedSeed = identity.accept({ seed, peerKeys, userKeys })

      const acceptanceMessage: AcceptIdentityMessage = {
        type: 'ACCEPT_IDENTITY',
        payload: { encryptedSeed },
      }

      this.sendMessage(acceptanceMessage)
    },

    rejectIdentity: context => {
      // log('ACTION rejectIdentity', context)
      this.fail('Unable to confirm identity')
    },

    saveSeed: (context, event) => {
      // log('ACTION saveSeed', context)
      // save seed
      const acceptanceMessage = event as AcceptIdentityMessage
      context.encryptedPeerSeed = acceptanceMessage.payload.encryptedSeed
    },

    deriveSecretKey: context => {
      // log('ACTION deriveSecretKey', context)

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

    failNeitherIsMember: () => {
      this.fail(`Can't connect; neither one of us is a member`)
    },

    rejectInvitation: () => {
      this.fail('Invalid invitation')
    },

    failTimeout: () => {
      this.fail('Connection timed out')
    },

    onConnected: () => {
      // log('ACTION onConnected', context)
      this.emit('connected')
    },

    onDisconnected: (context, event) => {
      this.emit('disconnected', event)
    },

    onError: (context, event) => {
      // log('ACTION onError', context)
      // this.emit('error', event)
    },
  }

  private fail = (message: string, details?: any) => {
    this.context.error = { message, details }
    const errorMessage: ErrorMessage = { type: 'ERROR', payload: { message, details } }
    this.deliver(errorMessage) // force error state locally
    this.sendMessage(errorMessage) // send error to peer
  }

  private readonly guards: Record<string, Condition> = {
    iHaveInvitation: context => {
      // log('GUARD iHaveInvitation', context)
      return context.invitationSecretKey !== undefined
    },

    theyHaveInvitation: context => {
      // log('GUARD theyHaveInvitation', context)
      return context.theirProofOfInvitation !== undefined
    },

    bothHaveInvitation: (...args) => {
      // log('GUARD bothHaveInvitation', context)
      return this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args)
    },

    invitationProofIsValid: context => {
      // log('GUARD invitationProofIsValid', context)
      const proofOfInvitation = context.theirProofOfInvitation!
      try {
        context.team!.admit(proofOfInvitation)
      } catch (e) {
        return false
      }
      return true
    },

    identityIsKnown: context => {
      log('GUARD identityIsKnown', context)
      const identityClaim = context.theirIdentityClaim!
      const userName = identityClaim.name
      return context.team!.has(userName)
    },

    identityProofIsValid: (context, event) => {
      // log('GUARD identityProofIsValid', context)
      const { team, challenge: originalChallenge } = context
      const identityProofMessage = event as ProveIdentityMessage
      const { challenge, proof } = identityProofMessage.payload

      if (originalChallenge !== challenge) return false
      const userName = challenge.name
      const publicKeys = team!.members(userName).keys
      const validation = identity.verify(challenge, proof, publicKeys)
      return validation.isValid
    },
  }
}

function log(label: string, context: ConnectionContext) {
  // console.log(`${context.user.userName}: ${label} ${Object.keys(context)}`)
}
