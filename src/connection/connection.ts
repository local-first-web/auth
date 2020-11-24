import { asymmetric } from '@herbcaudill/crypto'
import debug from 'debug'
import { EventEmitter } from 'events'
import { assign, createMachine, interpret, Interpreter } from 'xstate'
import { arrayToMap } from '../util/arrayToMap'
import { orderedDelivery } from './orderedDeliveryService'
import { getParentHashes } from '/chain'
import { connectionMachine } from '/connection/connectionMachine'
import { deriveSharedKey } from '/connection/deriveSharedKey'
import {
  AcceptIdentityMessage,
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  DisconnectMessage,
  ErrorMessage,
  HelloMessage,
  MissingLinksMessage,
  NumberedConnectionMessage,
  ProveIdentityMessage,
  UpdateMessage,
} from '/connection/message'
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
import { Team, TeamLinkMap } from '/team'
import { redactUser } from '/user'
import { assert } from '/util'
import { pause } from '/util/pause'

const { MEMBER } = KeyType

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol.  The XState configuration is in `machineConfig`.
 */
export class Connection extends EventEmitter {
  private sendMessage: SendFunction

  public machine: Interpreter<ConnectionContext, ConnectionStateSchema, ConnectionMessage>
  public context: ConnectionContext

  private incomingMessageQueue: Record<number, NumberedConnectionMessage> = {}
  private outgoingMessageIndex: number = 0

  constructor({ sendMessage, context }: ConnectionParams) {
    super()
    this.sendMessage = (message: ConnectionMessage) => {
      this.log(`-> ${message.type} (m${this.outgoingMessageIndex})`)
      sendMessage({
        ...message,
        index: this.outgoingMessageIndex,
      })
      this.outgoingMessageIndex += 1
    }
    this.context = context
  }

  private get log() {
    return debug(`taco:connection:${this.context.user.userName}`)
  }

  /** Starts the connection machine. Returns this Connection object. */
  public start = () => {
    // define state machine
    const machine = createMachine(connectionMachine, {
      actions: this.actions,
      guards: this.guards,
    }).withContext(this.context)

    // instantiate the machine and start the instance
    this.machine = interpret(machine)
      .onTransition(state => this.log(`state: %o`, state.value))
      .start()
    return this
  }

  /** Stops the connection machine and sends a disconnect message to the peer. */
  public stop = () => {
    const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
    this.machine.send(disconnectMessage) // send disconnect event to local machine
    this.sendMessage(disconnectMessage) // send disconnect message to peer
  }

  /** Returns the current state of the connection machine. */
  get state() {
    return this.machine.state.value
  }

  /** Passes an incoming message from the peer on to this connection machine, guaranteeing that
   *  messages will be delivered in the intended order (according to the `index` field on the message) */
  public async deliver(incomingMessage: NumberedConnectionMessage) {
    this.log(`<- ${incomingMessage.type} m${incomingMessage.index} ${getHead(incomingMessage)}`)

    const { queue, nextMessages } = orderedDelivery(this.incomingMessageQueue, incomingMessage)

    // update queue
    this.incomingMessageQueue = queue

    // send any messages that are ready to go out
    for (const m of nextMessages) {
      this.log(`(delivering m${m.index}) `)

      this.machine.send(m)
      await pause(1) // yield so that state machine has a chance to update
    }
  }

  // ACTIONS

  /** These are referred to by name in `connectionMachine` (e.g. `actions: 'sendHello'`) */
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
      seed: _ => randomKey(),
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

    sendUpdate: context => {
      const { root, head, links } = context.team!.chain
      const hashes = Object.keys(links)
      this.log(`sendUpdate ${trunc(head)} (${hashes.length})`)
      this.sendMessage({
        type: 'UPDATE',
        payload: { root, head, hashes },
      })
    },

    recordTheirHead: assign({
      theirHead: (context, event) => {
        this.log('recordTheirHead')
        const { payload } = event as UpdateMessage | MissingLinksMessage
        return payload.head
      },
    }),

    sendMissingLinks: (context, event) => {
      const { chain } = context.team!
      const { root, head, links } = chain
      const hashes = Object.keys(links)

      const {
        root: theirRoot,
        head: theirHead,
        hashes: theirHashes,
      } = (event as UpdateMessage).payload

      assert(root === theirRoot, `Our roots should be the same`)

      // if we have the same head, there are no missing links
      if (theirHead === head) return

      // send them every link that we have that they don't have
      const missingLinks = hashes
        .filter(hash => theirHashes.includes(hash) === false)
        .map(hash => links[hash])

      this.log(`sendMissingLinks ${trunc(head)} (${missingLinks.length})`)
      if (missingLinks.length > 0) {
        this.sendMessage({
          type: 'MISSING_LINKS',
          payload: { head, links: missingLinks },
        })
      }
    },

    receiveMissingLinks: assign({
      team: (context, event) => {
        const { chain } = context.team!
        const { root, links } = chain
        const { head: theirHead, links: theirLinks } = (event as MissingLinksMessage).payload

        this.log(`receiveMissingLinks ${trunc(theirHead)} (${theirLinks.length})`)

        const allLinks = {
          // all our links
          ...links,
          // all their new links, converted from an array to a hashmap
          ...theirLinks.reduce(arrayToMap('hash'), {}),
        } as TeamLinkMap

        // make sure we're not missing any links that are referenced by these new links
        const parentHashes = theirLinks.flatMap(link => getParentHashes(chain, link))
        const missingParents = parentHashes.filter(hash => !(hash in allLinks))
        assert(
          missingParents.length === 0,
          `Can't update; missing parent links: \n${missingParents.join('\n')}`
        )

        // we can now reconstruct their chain
        const theirChain = { root, head: theirHead, links: allLinks }

        // and merge with it
        return context.team!.merge(theirChain)
      },
    }),

    receiveError: assign({
      error: (_, event) => (event as ErrorMessage).payload,
    }),

    // failure modes

    rejectIdentity: () => this.fail(`I couldn't verify your identity`),
    failNeitherIsMember: () => this.fail(`We can't connect because neither one of us is a member`),
    rejectInvitation: () => this.fail(`Your invitation isn't valid - it may have been revoked`),
    rejectTeam: () => this.fail(`This is not the team I was invited to`),
    failTimeout: () => this.fail('Connection timed out'),

    // events for external listeners

    onConnected: () => this.emit('connected'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  // GUARDS

  /** These are referred to by name in `connectionMachine` (e.g. `cond: 'iHaveInvitation'`) */
  private readonly guards: Record<string, Condition> = {
    iHaveInvitation: context => {
      return context.invitationSecretKey !== undefined
    },

    theyHaveInvitation: context => {
      return context.theirProofOfInvitation !== undefined
    },

    bothHaveInvitation: (...args) =>
      this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args),

    invitationProofIsValid: context => {
      try {
        context.team!.admit(context.theirProofOfInvitation!)
      } catch (e) {
        this.context.error = { message: e.toString() }
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
      const { head } = context.team!.chain
      const { payload } = event as UpdateMessage | MissingLinksMessage
      const theirHead = payload !== undefined && head in payload ? payload.head : context.theirHead

      this.log(
        `headsAreEqual ${event.type} ${head === theirHead} (mine: ${trunc(head)}, theirs: ${trunc(
          theirHead
        )})`
      )
      return head === theirHead
    },

    headsAreDifferent: (...args) => !this.guards.headsAreEqual(...args),
  }

  // helpers

  private fail = (message: string, details?: any) => {
    const errorPayload = { message, details }
    this.log(errorPayload)
    this.context.error = errorPayload // store error for external access
    const errorMessage: ErrorMessage = { type: 'ERROR', payload: errorPayload }
    this.machine.send(errorMessage) // force error state locally
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
}

const trunc = (s?: string) => s?.slice(0, 5)

// for debugging
const getHead = (message: ConnectionMessage) =>
  message.payload && 'head' in message.payload ? trunc(message.payload.head) : ''
