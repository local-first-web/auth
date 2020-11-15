import { asymmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import { assign, createMachine, interpret, Interpreter } from 'xstate'
import { Team } from '/team'
import { deriveSharedKey } from '/connection/deriveSharedKey'
import { connectionMachine } from '/connection/connectionMachine'
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
  HelloMessage,
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
    const machine = createMachine(connectionMachine, {
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

  /** Used to trigger connection events */
  public deliver(incomingMessage: ConnectionMessage) {
    this.machine.send(incomingMessage)
  }

  /** Dictionary of actions referenced in `connectionMachine` */
  private readonly actions: Record<string, Action> = {
    sendHello: context => {
      this.sendMessage({
        type: 'HELLO',
        payload: {
          // claim our identity
          identityClaim: { type: MEMBER, name: context.user.userName },
          // if we're not a member yet, attach our proof of invitation
          proofOfInvitation:
            context.invitationSecretKey !== undefined
              ? invitations.acceptMemberInvitation(
                  context.invitationSecretKey,
                  redactUser(context.user)
                )
              : undefined,
        },
      })
    },

    receiveHello: assign({
      theirIdentityClaim: (_, event) => (event as HelloMessage).payload.identityClaim,
      theyHaveInvitation: (_, event) => !!(event as HelloMessage).payload.proofOfInvitation,
      theirProofOfInvitation: (_, event) => (event as HelloMessage).payload.proofOfInvitation,
    }),

    acceptInvitation: context => {
      // welcome them by sending the team's signature chain, so they can reconstruct team membership state
      this.sendMessage({
        type: 'ACCEPT_INVITATION',
        payload: { chain: context.team!.save() },
      } as AcceptInvitationMessage)
    },

    joinTeam: assign({
      team: (context, event) =>
        new Team({
          source: (event as AcceptInvitationMessage).payload.chain,
          context: { user: context.user },
        }),
    }),

    challengeIdentity: context => {
      const identityClaim = context.theirIdentityClaim!
      const challenge = identity.challenge(identityClaim)
      context.challenge = challenge
      this.sendMessage({
        type: 'CHALLENGE_IDENTITY',
        payload: { challenge },
      } as ChallengeIdentityMessage)
    },

    proveIdentity: (context, event) => {
      const { challenge } = (event as ChallengeIdentityMessage).payload
      const proof = identity.prove(challenge, context.user.keys)
      this.sendMessage({
        type: 'PROVE_IDENTITY',
        payload: { challenge, proof },
      } as ProveIdentityMessage)
    },

    generateSeed: assign({
      seed: context => randomKey(),
      peer: context => context.team!.members(context.theirIdentityClaim!.name),
    }),

    acceptIdentity: context => {
      // encrypt the seed and send it
      const encryptedSeed = identity.accept({
        seed: context.seed!,
        peerKeys: context.peer!.keys,
        userKeys: context.user.keys,
      })

      const acceptanceMessage: AcceptIdentityMessage = {
        type: 'ACCEPT_IDENTITY',
        payload: { encryptedSeed },
      }

      this.sendMessage(acceptanceMessage)
    },

    storeTheirEncryptedSeed: assign({
      theirEncryptedSeed: (_, event) => (event as AcceptIdentityMessage).payload.encryptedSeed,
    }),

    deriveSharedKey: assign({
      secretKey: context => {
        // we saved our seed in context
        const ourSeed = context.seed!
        // their seed is also in context but encrypted
        const theirSeed = asymmetric.decrypt({
          cipher: context.theirEncryptedSeed!,
          senderPublicKey: context.peer!.keys.encryption,
          recipientSecretKey: context.user.keys.encryption.secretKey,
        })
        return deriveSharedKey(ourSeed, theirSeed)
      },
    }),

    rejectIdentity: () => this.fail('Unable to confirm identity'),
    failNeitherIsMember: () => this.fail(`Can't connect; neither one of us is a member`),
    rejectInvitation: () => this.fail('Invalid invitation'),
    failTimeout: () => this.fail('Connection timed out'),

    onConnected: () => this.emit('connected'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  private fail = (message: string, details?: any) => {
    this.context.error = { message, details }
    const errorMessage: ErrorMessage = { type: 'ERROR', payload: { message, details } }
    this.deliver(errorMessage) // force error state locally
    this.sendMessage(errorMessage) // send error to peer
  }

  private readonly guards: Record<string, Condition> = {
    iHaveInvitation: context => {
      return context.invitationSecretKey !== undefined
    },

    theyHaveInvitation: context => {
      return context.theirProofOfInvitation !== undefined
    },

    bothHaveInvitation: (...args) => {
      return this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args)
    },

    invitationProofIsValid: context => {
      const proofOfInvitation = context.theirProofOfInvitation!
      try {
        context.team!.admit(proofOfInvitation)
      } catch (e) {
        return false
      }
      return true
    },

    identityIsKnown: context => {
      const identityClaim = context.theirIdentityClaim!
      const userName = identityClaim.name
      return context.team!.has(userName)
    },

    identityProofIsValid: (context, event) => {
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
