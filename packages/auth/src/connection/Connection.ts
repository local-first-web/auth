import { asymmetric, Payload, symmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import { Transform } from 'stream'
import { assign, createMachine, interpret, Interpreter } from 'xstate'
import { protocolMachine } from './protocolMachine'
import { deriveSharedKey } from '@/connection/deriveSharedKey'
import * as identity from '@/connection/identity'
import {
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  DisconnectMessage,
  EncryptedMessage,
  ErrorMessage,
  HelloMessage,
  LocalUpdateMessage,
  MissingLinksMessage,
  NumberedConnectionMessage,
  ProveIdentityMessage,
  SeedMessage,
  UpdateMessage,
} from '@/connection/message'
import { orderedDelivery } from '@/connection/orderedDelivery'
import {
  Condition,
  ConnectionContext,
  ConnectionParams,
  ConnectionState,
  hasInvitee,
  InitialContext,
  SendFunction,
  StateMachineAction,
} from '@/connection/types'
import { getDeviceId, parseDeviceId } from '@/device'
import * as invitations from '@/invitation'
import { generateStarterKeys } from '@/invitation/generateStarterKeys'
import { KeyType, randomKey } from '@/keyset'
import { Team } from '@/team'
import { arrayToMap, assert, debug } from '@/util'

const { DEVICE } = KeyType

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol. The XState configuration is in `machineConfig`.
 */
export class Connection extends EventEmitter {
  log: debug.Debugger

  private sendMessage: SendFunction
  private machine: Interpreter<ConnectionContext, ConnectionState, ConnectionMessage>
  private incomingMessageQueue: Record<number, NumberedConnectionMessage> = {}
  private outgoingMessageIndex: number = 0
  private isRunning: boolean = false

  constructor({ sendMessage, context }: ConnectionParams) {
    super()

    const name = hasInvitee(context) ? context.invitee.name : context.user.userName
    this.log = debug(`lf:auth:protocol:${name}`)

    // If we're a user connecting with an invitation, we need to use the starter keys derived from
    // our invitation seed
    if (hasInvitee(context) && context.user) {
      const starterKeys = generateStarterKeys(context.invitee, context.invitationSeed)
      context.user.keys = starterKeys
    }

    this.sendMessage = (message: ConnectionMessage) => {
      // add a sequential index to any outgoing messages
      const index = this.outgoingMessageIndex++
      this.logMessage('out', message, index)

      const messageWithIndex = { ...message, index }

      if (sendMessage) {
        // manual interface: send message using provided function
        sendMessage(messageWithIndex)
      } else {
        // streaming interface: serialize outgoing messages for the stream
        const serializedMessage = JSON.stringify(messageWithIndex)
        this.stream.push(serializedMessage)
      }
    }

    // define state machine
    const machine = createMachine(protocolMachine, {
      actions: this.actions,
      guards: this.guards,
    }).withContext(context)

    // instantiate the machine
    this.machine = interpret(machine).onTransition(state => {
      const summary = stateSummary(state.value)
      this.emit('change', summary)
      this.log(`⏩ ${summary}`)
    })
  }

  public stream: Transform = new Transform({
    transform: (chunk: any, _?: BufferEncoding | Callback, next?: Callback) => {
      if (typeof _ === 'function') next = _
      try {
        // deserialize incoming messages and deliver them to the machine
        const message = JSON.parse(chunk.toString())
        this.deliver(message)
        // callback with no error
        if (next) next(null)
      } catch (err) {
        console.error(err)
        // callback with error
        if (next) next(err)
      }
    },
  })

  /** Starts (or restarts) the protocol machine. Returns this Protocol object. */
  public start = (context?: Partial<InitialContext>) => {
    this.log('starting')
    if (!this.isRunning) {
      this.machine.start()
      this.isRunning = true
      this.sendMessage({ type: 'READY' })
    } else {
      this.machine.send({ type: 'RECONNECT' })
    }
    return this
  }

  /** Sends a disconnect message to the peer. */
  public stop = () => {
    const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
    this.sendMessage(disconnectMessage) // send disconnect message to peer
    if (this.isRunning && !this.machine.state.done) {
      this.machine.send(disconnectMessage) // send disconnect event to local machine
    }
    this.removeAllListeners()
    this.stream.removeAllListeners()
    return this
  }

  get userName() {
    if (!this.isRunning) return ''
    return hasInvitee(this.context) ? this.context.invitee.name : this.context.user!.userName
  }

  /** Returns the current state of the protocol machine. */
  get state() {
    if (!this.isRunning) return 'disconnected'
    else return this.machine.state.value
  }

  get context(): ConnectionContext {
    if (!this.isRunning) throw new Error(`Can't get context; machine not started`)
    return this.machine.state.context
  }

  get user() {
    return this.context.user
  }

  /** Returns the last error encountered by the protocol machine.
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
    if (!this.isRunning) return '? (not started)'
    return (
      this.context.peer?.userName ??
      this.context.theirIdentityClaim?.name ??
      this.context.theirProofOfInvitation?.invitee.name ??
      '?'
    )
  }

  /** Sends an encrypted message to the peer we're connected with */
  public send = (message: Payload) => {
    assert(this.context.sessionKey)

    const encryptedMessage = symmetric.encrypt(message, this.context.sessionKey)
    this.sendMessage({ type: 'ENCRYPTED_MESSAGE', payload: encryptedMessage })
  }

  /** Passes an incoming message from the peer on to this protocol machine, guaranteeing that
   *  messages will be delivered in the intended order (according to the `index` field on the message) */
  public async deliver(incomingMessage: NumberedConnectionMessage) {
    this.logMessage('in', incomingMessage, incomingMessage.index)
    const { queue, nextMessages } = orderedDelivery(this.incomingMessageQueue, incomingMessage)

    // TODO: detect hang when we've got message N+1 and message N doesn't come in for a while?

    // update queue
    this.incomingMessageQueue = queue

    // send any messages that are ready to go out
    for (const m of nextMessages) {
      if (this.isRunning && !this.machine.state.done) this.machine.send(m)
      else this.log(`stopped, not sending #${incomingMessage.index}`)
    }
  }

  // ACTIONS

  private fail = (message: string, details?: any) =>
    assign<ConnectionContext, ConnectionMessage>({
      error: () => {
        const errorPayload = { message, details }
        const errorMessage: ErrorMessage = { type: 'ERROR', payload: errorPayload }
        this.machine.send(errorMessage) // force error state locally
        this.sendMessage(errorMessage) // send error to peer
        return errorPayload
      },
    })

  /** These are referred to by name in `connectionMachine` (e.g. `actions: 'sendHello'`) */
  private readonly actions: Record<string, StateMachineAction> = {
    // initializing

    sendHello: async context => {
      this.sendMessage({
        type: 'HELLO',
        payload: {
          identityClaim: {
            type: DEVICE,
            name: getDeviceId(context.device),
          },
          proofOfInvitation: hasInvitee(context) ? this.myProofOfInvitation(context) : undefined,
        },
      } as HelloMessage)
    },

    // authenticating

    receiveHello: assign({
      theirIdentityClaim: (_, event) => {
        event = event as HelloMessage
        return 'identityClaim' in event.payload ? event.payload.identityClaim : undefined
      },

      theyHaveInvitation: (_, event) => {
        event = event as HelloMessage
        return 'proofOfInvitation' in event.payload
      },

      theirProofOfInvitation: (_, event) => {
        event = event as HelloMessage
        return 'proofOfInvitation' in event.payload ? event.payload.proofOfInvitation : undefined
      },
    }),

    acceptInvitation: context => {
      assert(context.team)
      // welcome them by sending the team's signature chain, so they can reconstruct team membership state
      this.sendMessage({
        type: 'ACCEPT_INVITATION',
        payload: { chain: context.team.save() },
      } as AcceptInvitationMessage)
    },

    joinTeam: (context, event) => {
      // we've just received the team's signature chain; reconstruct team
      const team = this.rehydrateTeam(context, event)

      // join the team
      const proof = this.myProofOfInvitation(context)
      const { user, device } = team.join(proof, this.context.invitationSeed!)

      // put the updated user, device, and team on our context
      this.context.user = user
      this.context.device = device
      this.context.team = team
    },

    challengeIdentity: assign({
      challenge: context => {
        const identityClaim = context.theirIdentityClaim!
        const challenge = identity.challenge(identityClaim)
        this.sendMessage({
          type: 'CHALLENGE_IDENTITY',
          payload: { challenge },
        } as ChallengeIdentityMessage)
        return challenge
      },
    }),

    proveIdentity: (context, event) => {
      assert(context.user)
      const { challenge } = (event as ChallengeIdentityMessage).payload
      const proof = identity.prove(challenge, context.device.keys)
      this.sendMessage({
        type: 'PROVE_IDENTITY',
        payload: { challenge, proof },
      } as ProveIdentityMessage)
    },

    storePeer: assign({
      peer: context => {
        assert(context.team)
        assert(context.theirIdentityClaim)
        const deviceId = context.theirIdentityClaim.name
        const { userName } = parseDeviceId(deviceId)
        if (context.team.has(userName)) {
          // peer still on the team
          return context.team.members(userName)
        } else {
          // peer was removed from team
          return undefined
        }
      },
    }),

    acceptIdentity: _ => {
      this.sendMessage({
        type: 'ACCEPT_IDENTITY',
        payload: {},
      })
    },

    // updating

    sendUpdate: context => {
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
      const { payload } = event as UpdateMessage
      const links = context.team.getMissingLinks(payload)
      if (links.length > 0) {
        this.sendMessage({
          type: 'MISSING_LINKS',
          payload: { head: context.team.chain.head, links },
        })
      }
    },

    receiveMissingLinks: assign({
      team: (context, event) => {
        assert(context.team)
        const { payload } = event as MissingLinksMessage
        return context.team.receiveMissingLinks(payload)
      },
    }),

    listenForTeamUpdates: context => {
      assert(context.team)
      context.team.addListener('updated', ({ head }) => {
        if (!this.machine.state.done) {
          this.log(`LOCAL_UPDATE ${head}`)
          this.machine.send({ type: 'LOCAL_UPDATE', payload: { head } }) // send update event to local machine
        }
      })
    },

    // negotiating

    generateSeed: assign({ seed: _ => randomKey() }),

    sendSeed: context => {
      assert(context.user)
      assert(context.peer)
      assert(context.seed)

      const encryptedSeed = asymmetric.encrypt({
        secret: context.seed,
        recipientPublicKey: context.peer.keys.encryption,
        senderSecretKey: context.user.keys.encryption.secretKey,
      })

      this.sendMessage({
        type: 'SEED',
        payload: { encryptedSeed },
      })
    },

    receiveSeed: assign({
      theirEncryptedSeed: (_, event) => {
        return (event as SeedMessage).payload.encryptedSeed
      },
    }),

    deriveSharedKey: assign({
      sessionKey: (context, event) => {
        assert(context.user)
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

    // communicating

    receiveEncryptedMessage: (context, event) => {
      assert(context.sessionKey)
      const encryptedMessage = (event as EncryptedMessage).payload
      const decryptedMessage = symmetric.decrypt(encryptedMessage, context.sessionKey)
      this.emit('message', decryptedMessage)
    },

    // failure

    receiveError: assign({
      error: (_, event) => (event as ErrorMessage).payload,
    }),

    rejectIdentity: this.fail(`I couldn't verify your identity.`),
    failNeitherIsMember: this.fail(`We can't connect because neither one of us is a member.`),
    rejectInvitation: this.fail(`Your invitation didn't work - maybe the code was mistyped?`),
    rejectTeam: this.fail(`This is not the team I was invited to.`),
    failPeerWasRemoved: this.fail(`You were removed from the team.`),
    failTimeout: this.fail('Connection timed out.'),

    // events for external listeners

    onConnected: () => this.emit('connected'),
    onJoined: () => this.emit('joined'),
    onUpdated: () => this.emit('updated'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  // GUARDS

  /** These are referred to by name in `connectionMachine` (e.g. `cond: 'iHaveInvitation'`) */
  private readonly guards: Record<string, Condition> = {
    iHaveInvitation: context => hasInvitee(context),

    theyHaveInvitation: context => context.theyHaveInvitation === true,

    bothHaveInvitation: (...args) =>
      this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args),

    // TODO smells bad that this guard has the side effect of admitting the person - split this up
    // into two processes, first validating their proof, then admitting them
    invitationProofIsValid: context => {
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

    identityIsKnown: context => {
      if (context.team === undefined) return true // we're not on the team yet so we can't say if they're a member
      assert(context.theirIdentityClaim)
      return context.team.identityIsKnown(context.theirIdentityClaim)
    },

    identityProofIsValid: (context, event) => {
      assert(context.team)
      const { challenge, proof } = (event as ProveIdentityMessage).payload
      return context.team.verifyIdentity(challenge, proof)
    },

    headsAreEqual: (context, event) => {
      assert(context.team)

      // If their message includes a head, use that; otherwise use the last head we had recorded
      const { type, payload } = event as UpdateMessage | MissingLinksMessage | LocalUpdateMessage
      const theirHead =
        type === 'UPDATE' || type === 'MISSING_LINKS'
          ? payload.head // take from message
          : context.theirHead // use what we already have in context

      const ourHead = context.team.chain.head

      return ourHead === theirHead
    },

    headsAreDifferent: (...args) => !this.guards.headsAreEqual(...args),

    dontHaveSessionkey: context => context.sessionKey === undefined,

    peerWasRemoved: context => {
      assert(context.team)
      assert(context.peer)
      return context.team.has(context.peer.userName) === false
    },
  }

  // helpers

  private logMessage = (direction: 'in' | 'out', message: ConnectionMessage, index: number) => {
    const arrow = direction === 'in' ? '<-' : '->'
    this.log(`${arrow} ${this.peerName} #${index} ${message.type} ${messageSummary(message)}`)
  }

  private rehydrateTeam = (context: ConnectionContext, event: ConnectionMessage) => {
    return new Team({
      source: (event as AcceptInvitationMessage).payload.chain,
      context: { user: context.user!, device: context.device },
    })
  }

  private myProofOfInvitation = (context: ConnectionContext) => {
    assert(context.invitationSeed)
    assert(context.invitee)
    return invitations.generateProof(context.invitationSeed, context.invitee)
  }
}

// for debugging

const messageSummary = (message: ConnectionMessage) =>
  // @ts-ignore
  message.payload?.head || message.payload?.message || ''

const isString = (state: any) => typeof state === 'string'

const stateSummary = (state: any = 'disconnected'): string =>
  isString(state)
    ? state === 'done'
      ? ''
      : state
    : Object.keys(state)
        .map(key => `${key}:${stateSummary(state[key])}`)
        .filter(s => s.length)
        .join(',')

type Callback = (error: Error | null | undefined) => void
