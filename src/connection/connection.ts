import { asymmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import { assign, createMachine, interpret, Interpreter } from 'xstate'
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
  DisconnectMessage,
  ErrorMessage,
  HelloMessage,
  ProveIdentityMessage,
} from '/connection/message'
import { Team } from '/team'
import { redactUser } from '/user'

const { MEMBER } = KeyType

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol.  The XState configuration is in `machineConfig`.
 */
export class Connection extends EventEmitter {
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

  public stop = () => {
    const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
    this.deliver(disconnectMessage) // send disconnect event to local machine
    this.sendMessage(disconnectMessage) // send disconnect message to peer
  }

  get state() {
    return this.machine.state.value
  }

  /** Used to trigger connection events */
  public deliver(incomingMessage: ConnectionMessage) {
    this.machine.send(incomingMessage)
  }

  // ACTIONS

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
              ? this.myProofOfInvitation(context)
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
      team: (context, event) => this.rehydrateTeam(context, event),
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
      this.sendMessage({
        type: 'ACCEPT_IDENTITY',
        payload: {
          encryptedSeed: asymmetric.encrypt({
            secret: context.seed!,
            recipientPublicKey: context.peer!.keys.encryption,
            senderSecretKey: context.user.keys.encryption.secretKey,
          }),
        },
      } as AcceptIdentityMessage)
    },

    storeTheirEncryptedSeed: assign({
      theirEncryptedSeed: (_, event) => (event as AcceptIdentityMessage).payload.encryptedSeed,
    }),

    deriveSharedKey: assign({
      sessionKey: context => {
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

    sendUpdate: (context, event) => this.sendMessage({
      type: 'UPDATE',
      payload: {
        head: context.team!.
      }
    }),

    sendMissingLinks: (context, event) => {},
    
    receiveMissingLinks: (context, event) => { },

    // failure modes

    rejectIdentity: () => this.fail(`I couldn't verify your identity`),
    failNeitherIsMember: () => this.fail(`We can't connect because neither one of us is a member`),
    rejectInvitation: () => this.fail('Your invitation is invalid'),
    rejectTeam: () => this.fail(`This is not the team I was invited to`),
    failTimeout: () => this.fail('Connection timed out'),

    // events for external listeners

    onConnected: () => this.emit('connected'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  private fail = (message: string, details?: any) => {
    this.context.error = { message, details } // store error for external access
    const errorMessage: ErrorMessage = { type: 'ERROR', payload: { message, details } }
    this.deliver(errorMessage) // force error state locally
    this.sendMessage(errorMessage) // send error to peer
  }

  private rehydrateTeam = (context: ConnectionContext, event: ConnectionMessage) =>
    new Team({
      source: (event as AcceptInvitationMessage).payload.chain,
      context: { user: context.user },
    })

  private myProofOfInvitation = (context: ConnectionContext) => {
    return invitations.acceptMemberInvitation(
      context.invitationSecretKey!,
      redactUser(context.user)
    )
  }

  // GUARDS

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
      try {
        context.team!.admit(context.theirProofOfInvitation!)
      } catch (e) {
        if (e instanceof Error) context.error = { message: e.message }
        return false
      }
      return true
    },

    joinedTheRightTeam: (context, event) => {
      // Make sure my invitation exists on the signature chain of the team I'm about to join.
      // This check prevents an attack in which a fake team pretends to accept my invitation.
      const team = this.rehydrateTeam(context, event)
      return team.hasInvitation(this.myProofOfInvitation(context))
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

    headsAreEqual: (context, event) => {
      return true
    },
  }
}
