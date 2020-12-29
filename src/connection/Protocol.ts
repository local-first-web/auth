import { asymmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import * as R from 'ramda'
import { assign, createMachine, interpret, Interpreter } from 'xstate'
import { getParentHashes, TeamLinkMap } from '/chain'
import { protocolMachine } from './protocolMachine'
import { deriveSharedKey } from '/connection/deriveSharedKey'
import * as identity from '/connection/identity'
import {
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  DisconnectMessage,
  ErrorMessage,
  HelloMessage,
  LocalUpdateMessage,
  MissingLinksMessage,
  NumberedConnectionMessage,
  ProveIdentityMessage,
  SeedMessage,
  UpdateMessage,
} from '/connection/message'
import { orderedDelivery } from '/connection/orderedDelivery'
import {
  Action,
  Condition,
  ConnectionContext,
  ConnectionParams,
  ConnectionState,
  SendFunction,
} from '/connection/types'
import * as invitations from '/invitation'
import { KeyType, randomKey } from '/keyset'
import { Team } from '/team'
import { arrayToMap, assert, debug } from '/util'

const { MEMBER } = KeyType

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol. The XState configuration is in `machineConfig`.
 */
export class Protocol extends EventEmitter {
  private sendMessage: SendFunction
  private machine: Interpreter<ConnectionContext, ConnectionState, ConnectionMessage>
  private incomingMessageQueue: Record<number, NumberedConnectionMessage> = {}
  private outgoingMessageIndex: number = 0
  private log: debug.Debugger

  private userName: string
  private started: boolean = false

  constructor({ sendMessage, context }: ConnectionParams) {
    super()

    this.userName = context.user.userName
    this.log = debug(`lf:auth:connection:${this.userName}`)
    this.log('new connection')

    this.sendMessage = (message: ConnectionMessage) => {
      const index = this.outgoingMessageIndex++
      this.logMessage('out', message, index)
      sendMessage({ ...message, index })
    }
    // define state machine
    const machine = createMachine(protocolMachine, {
      actions: this.actions,
      guards: this.guards,
    }).withContext(context)

    // instantiate the machine
    this.machine = interpret(machine).onTransition(this.logState)
  }

  private logState = (state: any) => {
    const stateSummary = (state: any): string => {
      const s = isString(state)
        ? state
        : Object.keys(state)
            .map((key) => {
              const substate = state[key]
              return substate === 'done' ? '' : `${key}:${stateSummary(substate)}`
            })
            .filter((s) => s.length)
            .join(',')
      return s //
        .replace(/disconnected/g, '❌')
        .replace(/connected/g, '✅')
    }

    return this.log(`⏩ ${stateSummary(state.value)}`)
  }

  private logMessage = (direction: 'in' | 'out', message: ConnectionMessage, index: number) => {
    const arrow = direction === 'in' ? '<-' : '->'
    this.log(`${arrow} ${this.peerName} ${message.type} #${index} ${getHead(message)}`)
  }

  /** Starts the connection machine. Returns this Connection object. */
  public start = () => {
    this.log('starting')
    this.started = true
    this.machine.start()
    return this
  }

  /** Stops the connection machine and sends a disconnect message to the peer. */
  public stop = () => {
    const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
    this.sendMessage(disconnectMessage) // send disconnect message to peer
    if (this.started && !this.machine.state.done) {
      this.started = false
      this.machine.send(disconnectMessage) // send disconnect event to local machine
    }
  }

  /** Returns the current state of the connection machine. */
  get state() {
    if (!this.started) return 'disconnected'
    else return this.machine.state.value
  }

  get context() {
    if (!this.started) throw new Error(`Can't get context; machine not started`)
    return this.machine.state.context
  }

  get user() {
    return this.context.user
  }

  /** Returns the last error encountered by the connection machine.
   * If no error has occurred, returns undefined.
   */
  get error() {
    return this.context.error
  }

  /** Returns the team that the connection's user is a member of.
   * If the user has not yet joined a team, returns undefined.
   */
  get team() {
    return this.context.team
  }

  /** Returns the connection's session key when we are in a connected state.
   * Otherwise, returns `undefined`.
   */
  get sessionKey() {
    return this.context.sessionKey
  }

  get peerName() {
    if (!this.started) return '? (not started)'
    return (
      this.context.peer?.userName ??
      this.context.theirIdentityClaim?.name ??
      this.context.theirProofOfInvitation?.userName ??
      '?'
    )
  }

  /** Passes an incoming message from the peer on to this connection machine, guaranteeing that
   *  messages will be delivered in the intended order (according to the `index` field on the message) */
  public async deliver(incomingMessage: NumberedConnectionMessage) {
    this.logMessage('in', incomingMessage, incomingMessage.index)
    const { queue, nextMessages } = orderedDelivery(this.incomingMessageQueue, incomingMessage)

    // TODO: detect hang when we've got message N+1 and message N doesn't come in for a while?

    // update queue
    this.incomingMessageQueue = queue

    // send any messages that are ready to go out
    for (const m of nextMessages) {
      if (this.started && !this.machine.state.done) this.machine.send(m)
      else this.log(`stopped, not sending #${incomingMessage.index}`)
    }
  }

  // ACTIONS

  private fail = (message: string, details?: any) =>
    assign({
      error: (context, event) => {
        // console.error(message)
        const errorPayload = { message, details }
        const errorMessage: ErrorMessage = { type: 'ERROR', payload: errorPayload }
        this.machine.send(errorMessage) // force error state locally
        this.sendMessage(errorMessage) // send error to peer
        return errorPayload
      },
    })

  /** These are referred to by name in `connectionMachine` (e.g. `actions: 'sendHello'`) */
  private readonly actions: Record<string, Action> = {
    sendReady: () => {
      // We send a READY message without any content just to make sure there's someone at the other
      // end before we identify ourselves etc.
      this.sendMessage({ type: 'READY', payload: {} })
    },

    sendHello: (context) => {
      this.sendMessage({
        type: 'HELLO',
        payload: {
          // claim our identity
          identityClaim: { type: MEMBER, name: context.user.userName },
          // if we're not a member yet, attach our proof of invitation
          proofOfInvitation:
            context.invitationSeed !== undefined ? this.myProofOfInvitation(context) : undefined,
        },
      })
    },

    // authenticating

    // TODO: authentication should always use device keys, not member keys

    receiveHello: assign({
      theirIdentityClaim: (_, event) => (event as HelloMessage).payload.identityClaim,
      theyHaveInvitation: (_, event) => !!(event as HelloMessage).payload.proofOfInvitation,
      theirProofOfInvitation: (_, event) => (event as HelloMessage).payload.proofOfInvitation,
    }),

    acceptInvitation: (context) => {
      assert(context.team)
      // welcome them by sending the team's signature chain, so they can reconstruct team membership state
      this.sendMessage({
        type: 'ACCEPT_INVITATION',
        payload: { chain: context.team.save() },
      } as AcceptInvitationMessage)
    },

    joinTeam: assign({
      team: (context, event) => {
        const team = this.rehydrateTeam(context, event)
        team.join(this.myProofOfInvitation(context))
        return team
      },
    }),

    challengeIdentity: (context) => {
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

    storePeer: assign({
      peer: (context) => {
        assert(context.team)
        assert(context.theirIdentityClaim)
        return context.team.members(context.theirIdentityClaim.name)
      },
    }),

    acceptIdentity: (_) => {
      this.sendMessage({
        type: 'ACCEPT_IDENTITY',
        payload: {},
      })
    },

    // updating

    sendUpdate: (context) => {
      assert(context.team)
      const { root, head, links } = context.team.chain
      const hashes = Object.keys(links)
      this.sendMessage({
        type: 'UPDATE',
        payload: { root, head, hashes },
      })
    },

    recordTheirHead: assign({
      theirHead: (_, event) => {
        const { payload } = event as UpdateMessage | MissingLinksMessage
        return payload.head
      },
    }),

    sendMissingLinks: (context, event) => {
      assert(context.team)
      const { chain } = context.team
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
        .filter((hash) => theirHashes.includes(hash) === false)
        .map((hash) => links[hash])

      if (missingLinks.length > 0) {
        this.sendMessage({
          type: 'MISSING_LINKS',
          payload: { head, links: missingLinks },
        })
      }
    },

    receiveMissingLinks: assign({
      team: (context, event) => {
        assert(context.team)
        const { chain } = context.team

        const { root, links } = chain
        const { head: theirHead, links: theirLinksArray } = (event as MissingLinksMessage).payload
        const theirLinks = theirLinksArray.reduce(arrayToMap('hash'), {})

        const allLinks = {
          // all our links
          ...links,
          // all their new links, converted from an array to a hashmap
          ...theirLinks,
        } as TeamLinkMap

        // make sure we're not missing any links that are referenced by these new links (shouldn't happen)
        const parentHashes = theirLinksArray.flatMap((link) => getParentHashes(chain, link))
        const missingParents = parentHashes.filter((hash) => !(hash in allLinks))
        assert(
          missingParents.length === 0,
          `Can't update; missing parent links: \n${missingParents.join('\n')}`
        )

        // we can now reconstruct their chain
        const theirChain = { root, head: theirHead, links: allLinks }

        // and merge with it
        return context.team.merge(theirChain)
      },
    }),

    refreshContext: assign({
      // Following an update, we may have new information about the peer
      // (specifically, if they just joined with an invitation, we'll have received
      // their real public keys). So we need to get that on context now.
      peer: (context) => {
        assert(context.peer)
        assert(context.team)
        const userName = context.peer.userName
        if (context.team.has(userName)) {
          // peer still on the team
          return context.team.members(userName)
        } else {
          // peer was removed from team
          return undefined
        }
      },
    }),

    listenForUpdates: (context) => {
      assert(context.team)
      context.team.addListener('updated', ({ head }) => {
        if (!this.machine.state.done) {
          this.log(`LOCAL_UPDATE ${head}`)
          this.machine.send({ type: 'LOCAL_UPDATE', payload: { head } }) // send update event to local machine
        }
      })
    },

    // negotiating

    generateSeed: assign({ seed: (_) => randomKey() }),

    sendSeed: (context) => {
      assert(context.peer)
      assert(context.seed)

      this.sendMessage({
        type: 'SEED',
        payload: {
          encryptedSeed: asymmetric.encrypt({
            secret: context.seed,
            recipientPublicKey: context.peer.keys.encryption,
            senderSecretKey: context.user.keys.encryption.secretKey,
          }),
        },
      })
    },

    receiveSeed: assign({
      theirEncryptedSeed: (_, event) => {
        return (event as SeedMessage).payload.encryptedSeed
      },
    }),

    deriveSharedKey: assign({
      sessionKey: (context, event) => {
        assert(context.theirEncryptedSeed)
        assert(context.seed)
        assert(context.peer)

        // we saved our seed in context
        const ourSeed = context.seed

        // their seed is encrypted and stored in context
        const theirSeed = asymmetric.decrypt({
          cipher: context.theirEncryptedSeed,
          senderPublicKey: context.peer.keys.encryption,
          recipientSecretKey: context.user.keys.encryption.secretKey,
        })

        // with the two keys, we derive a shared key
        return deriveSharedKey(ourSeed, theirSeed)
      },
    }),

    // failure

    receiveError: assign({
      error: (_, event) => (event as ErrorMessage).payload,
    }),

    rejectIdentity: this.fail(`I couldn't verify your identity`),
    failNeitherIsMember: this.fail(`We can't connect because neither one of us is a member`),
    rejectInvitation: this.fail(`Your invitation isn't valid - it may have been revoked`),
    rejectTeam: this.fail(`This is not the team I was invited to`),
    failPeerWasRemoved: this.fail(`You were removed from the team`),
    failTimeout: this.fail('Connection timed out'),

    // events for external listeners

    onConnected: () => this.emit('connected'),
    onJoined: () => this.emit('joined'),
    onUpdated: () => this.emit('updated'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  emit(event: string | symbol, ...args: any[]) {
    this.log('emitting %o', event)
    super.emit(event, ...args)
    return true
  }

  // GUARDS

  /** These are referred to by name in `connectionMachine` (e.g. `cond: 'iHaveInvitation'`) */
  private readonly guards: Record<string, Condition> = {
    iHaveInvitation: (context) => {
      const result = context.invitationSeed !== undefined
      return result
    },

    theyHaveInvitation: (context) => {
      const result = context.theirProofOfInvitation !== undefined
      return result
    },

    bothHaveInvitation: (...args) =>
      this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args),

    invitationProofIsValid: (context) => {
      assert(context.team)
      assert(context.theirProofOfInvitation)

      try {
        context.team.admit(context.theirProofOfInvitation)
      } catch (e) {
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

    identityIsKnown: (context) => {
      if (context.team === undefined) return true
      const identityClaim = context.theirIdentityClaim!
      const userName = identityClaim.name
      return context.team.has(userName)
    },

    identityProofIsValid: (context, event) => {
      assert(context.team)
      const { team, challenge: originalChallenge } = context
      const identityProofMessage = event as ProveIdentityMessage
      const { challenge, proof } = identityProofMessage.payload

      if (!R.equals(originalChallenge, challenge)) return false
      const userName = challenge.name
      const publicKeys = team.members(userName).keys
      const validation = identity.verify(challenge, proof, publicKeys)
      return validation.isValid
    },

    headsAreEqual: (context, event) => {
      assert(context.team)
      const { head } = context.team.chain
      const { type, payload } = event as UpdateMessage | MissingLinksMessage | LocalUpdateMessage
      const theirHead =
        type === 'UPDATE' || type === 'MISSING_LINKS'
          ? payload.head // take from message
          : context.theirHead // use what we already have in context
      const result = head === theirHead
      return result
    },

    headsAreDifferent: (...args) => !this.guards.headsAreEqual(...args),

    dontHaveSessionkey: (context) => context.sessionKey === undefined,

    peerWasRemoved: (context) => {
      assert(context.team)
      assert(context.peer)
      return context.team.has(context.peer.userName) === false
    },
  }

  // helpers

  private rehydrateTeam = (context: ConnectionContext, event: ConnectionMessage) =>
    new Team({
      source: (event as AcceptInvitationMessage).payload.chain,
      context: { user: context.user },
    })

  private myProofOfInvitation = (context: ConnectionContext) => {
    assert(context.invitationSeed)
    return invitations.generateProof(context.invitationSeed, context.user.userName)
  }
}

// for debugging

const getHead = (message: ConnectionMessage) =>
  message.payload && 'head' in message.payload ? message.payload.head : ''

const isString = (state: any) => typeof state === 'string'
