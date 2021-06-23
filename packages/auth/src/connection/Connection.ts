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
  NumberedConnectionMessage,
  ProveIdentityMessage,
  SeedMessage,
  SyncMessage,
} from '@/connection/message'
import { orderedDelivery } from '@/connection/orderedDelivery'
import {
  Condition,
  ConnectionContext,
  ConnectionParams,
  ConnectionState,
  isInvitee,
  SendFunction,
  StateMachineAction,
} from '@/connection/types'
import { getDeviceId, parseDeviceId } from '@/device'
import * as invitations from '@/invitation'
import { KeyType, randomKey, redactKeys } from '@/keyset'
import * as sync from '@/sync'
import { Team } from '@/team'
import { assert, debug } from '@/util'
import { asymmetric, Payload, symmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import { assign, createMachine, interpret, Interpreter } from 'xstate'
import { protocolMachine } from './protocolMachine'

const { DEVICE } = KeyType

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol. The XState configuration is in `protocolMachine`.
 */
export class Connection extends EventEmitter {
  public log: debug.Debugger

  private sendMessage: SendFunction
  private peerUserName: string = '?'

  private machine: Interpreter<ConnectionContext, ConnectionState, ConnectionMessage>
  private incomingMessageQueue: Record<number, NumberedConnectionMessage> = {}
  private outgoingMessageIndex: number = 0
  private started: boolean = false

  constructor({ sendMessage, context, peerUserName }: ConnectionParams) {
    super()

    if (peerUserName) {
      this.peerUserName = peerUserName
    }

    this.log = debug(`lf:auth:connection:${context.device.userName}:${this.peerUserName}`)

    this.sendMessage = (message: ConnectionMessage) => {
      // add a sequential index to any outgoing messages
      const index = this.outgoingMessageIndex++
      const messageWithIndex = { ...message, index }
      this.logMessage('out', message, index)
      sendMessage(messageWithIndex)
    }

    // define state machine
    const machineConfig = { actions: this.actions, guards: this.guards }
    const machine = createMachine(protocolMachine, machineConfig).withContext(context)

    // instantiate the machine
    this.machine = interpret(machine)

    // emit and log transitions
    this.machine.onTransition((state, event) => {
      const summary = stateSummary(state.value)
      this.emit('change', summary)
      this.log(`${messageSummary(event)} ⏩ ${summary} `)
    })
  }

  /** Starts (or restarts) the protocol machine. Returns this Protocol object. */
  public start = (storedMessages: string[] = []) => {
    this.log('starting')
    if (!this.started) {
      this.machine.start()
      this.started = true
      this.sendMessage({ type: 'READY' })

      // deliver any stored messages we might have received before starting
      storedMessages.forEach(m => this.deliver(JSON.parse(m)))
    } else {
      this.machine.send({ type: 'RECONNECT' })
    }
    return this
  }

  /** Sends a disconnect message to the peer. */
  public stop = () => {
    if (this.started && !this.machine.state.done) {
      const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
      this.sendMessage(disconnectMessage) // send disconnect message to peer
      this.machine.send(disconnectMessage) // send disconnect event to local machine
    }
    this.removeAllListeners()
    this.machine.stop()
    this.machine.state.done = true
    this.log('machine stopped: %o', this.machine.state.done)
    return this
  }

  /** Returns the local user's name. */
  get userName() {
    if (!this.started) return '(not started)'
    return 'user' in this.context && this.context.user !== undefined
      ? this.context.user.userName
      : 'userName' in this.context && this.context.userName !== undefined
      ? this.context.userName
      : 'unknown'
  }

  /** Returns the current state of the protocol machine. */
  get state() {
    if (!this.started) return 'disconnected'
    else return this.machine.state.value
  }

  get context(): ConnectionContext {
    if (!this.started) throw new Error(`Can't get context; machine not started`)
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
    if (!this.started) return '(not started)'
    return this.context.peer?.userName ?? this.context.theirIdentityClaim?.name ?? '?'
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

    // update queue
    this.incomingMessageQueue = queue

    // TODO: detect hang when we've got message N+1 and message N doesn't come in for a while?

    // send any messages that are ready to go out
    for (const m of nextMessages) {
      if (this.started && !this.machine.state.done) {
        this.log(`delivering #${m.index} from ${this.peerName}`)
        this.machine.send(m)
      } else this.log(`stopped, not delivering #${m.index}`)
    }
  }

  // ACTIONS

  private createError = (message: () => string, details?: any) => {
    const errorPayload = { message: message(), details }
    const errorMessage: ErrorMessage = { type: 'ERROR', payload: errorPayload }
    this.machine.send(errorMessage) // force error state locally
    this.sendMessage(errorMessage) // send error to peer
    return errorPayload
  }

  private fail = (message: () => string, details?: any) =>
    assign<ConnectionContext, ConnectionMessage>({
      error: () => this.createError(message, details),
    })

  /** These are referred to by name in `connectionMachine` (e.g. `actions: 'sendHello'`) */
  private readonly actions: Record<string, StateMachineAction> = {
    sendHello: async context => {
      const payload: HelloMessage['payload'] =
        'team' in context
          ? {
              identityClaim: {
                type: DEVICE,
                name: getDeviceId(context.device),
              },
            }
          : {
              proofOfInvitation: this.myProofOfInvitation(context),
              deviceKeys: redactKeys(context.device.keys),
              // TODO make this more readable
              ...('user' in context && context.user !== undefined
                ? { userKeys: redactKeys(context.user.keys) }
                : {}),
            }

      this.log('sending HELLO', payload)
      this.sendMessage({
        type: 'HELLO',
        payload,
      })
    },

    receiveHello: assign({
      theirIdentityClaim: (context, event) => {
        event = event as HelloMessage
        if ('identityClaim' in event.payload) {
          // update peer user name
          const deviceId = event.payload.identityClaim.name
          this.peerUserName = parseDeviceId(deviceId).userName
          this.log = debug(`lf:auth:connection:${context.device.userName}:${this.peerUserName}`)

          return event.payload.identityClaim
        } else {
          return undefined
        }
      },

      theyHaveInvitation: (_, event) => {
        event = event as HelloMessage
        if ('proofOfInvitation' in event.payload) {
          return true
        } else {
          return false
        }
      },

      theirProofOfInvitation: (_, event) => {
        event = event as HelloMessage
        if ('proofOfInvitation' in event.payload) {
          return event.payload.proofOfInvitation
        } else {
          return undefined
        }
      },

      theirUserKeys: (_, event) => {
        event = event as HelloMessage
        if ('userKeys' in event.payload) {
          return event.payload.userKeys
        } else {
          return undefined
        }
      },

      theirDeviceKeys: (context, event) => {
        event = event as HelloMessage
        if ('deviceKeys' in event.payload) {
          // update peer user name
          const deviceId = event.payload.deviceKeys.name
          this.peerUserName = parseDeviceId(deviceId).userName
          this.log = debug(`lf:auth:connection:${context.device.userName}:${this.peerUserName}`)

          return event.payload.deviceKeys
        } else {
          return undefined
        }
      },
    }),

    // handling invitations

    acceptInvitation: context => {
      assert(context.team)
      assert(context.theirProofOfInvitation)
      assert(context.theirDeviceKeys)

      // admit them to the team
      if ('theirUserKeys' in context && context.theirUserKeys !== undefined) {
        // new member
        context.team.admitMember(context.theirProofOfInvitation, context.theirUserKeys)
      } else {
        // new device for existing member
        const userName = parseDeviceId(context.theirDeviceKeys.name).userName
        context.team.admitDevice(
          context.theirProofOfInvitation, //
          userName,
          context.theirDeviceKeys
        )
      }

      // welcome them by sending the team's signature chain, so they can reconstruct team membership state
      this.sendMessage({
        type: 'ACCEPT_INVITATION',
        payload: { chain: context.team.save() },
      } as AcceptInvitationMessage)
    },

    joinTeam: (context, event) => {
      assert(this.context.invitationSeed)

      // we've just received the team's signature chain; reconstruct team
      const team = this.rehydrateTeam(context, event)

      // TODO: replace all these `'foo' in context` checks with proper type guards

      // join the team
      if ('userName' in context && context.userName) {
        // we get the user's keys from the team and rehydrate our user that way
        this.context.user = team.joinAsDevice(context.userName)
      } else {
        // we add our current device to the team chain
        team.joinAsMember()
      }

      // put the updated team on our context
      this.context.team = team
    },

    // authenticating

    /**
     * Looks up the device name (e.g. alice::laptop) on the team chain. Returns an appropriate error if
     * - the member is unknown
     * - the member is known but has been removed
     * - the member does not have a device by that name
     * - the member had a device by that name but it was removed
     *
     * When on the happy path (user and device both in good standing) does nothing.
     */
    confirmIdentityExists: (context, event) => {
      // if we're not on the team yet, we don't have a way of knowing if the peer is
      if (context.team === undefined) return
      event = event as HelloMessage

      // if no identity claim is being made, there's nothing to confirm
      if (!('identityClaim' in event.payload)) return

      const { identityClaim } = event.payload

      if (identityClaim === undefined) return

      const deviceId = identityClaim.name
      const { userName, deviceName } = parseDeviceId(deviceId)

      const identityLookupResult = context.team.lookupIdentity(identityClaim)

      const fail = (msg: string) => {
        debugger
        context.error = this.createError(() => msg)
      }

      switch (identityLookupResult) {
        case 'MEMBER_UNKNOWN':
          return fail(`${userName} is not a member of this team.`)

        case 'MEMBER_REMOVED':
          return fail(`${userName} was removed from this team.`)

        case 'DEVICE_UNKNOWN':
          return fail(`${userName} does not have a device '${deviceName}'.`)

        case 'DEVICE_REMOVED':
          return fail(`${userName}'s device '${deviceName}' was removed.`)

        case 'VALID_DEVICE':
          // 👍 continue
          return
      }
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
        assert(this.peerUserName)
        if (context.team.has(this.peerUserName)) {
          // peer still on the team
          return context.team.members(this.peerUserName)
        } else {
          // peer was removed from team
          return undefined
        }
      },
    }),

    acceptIdentity: () => {
      this.sendMessage({
        type: 'ACCEPT_IDENTITY',
        payload: {},
      })
    },

    // updating

    listenForTeamUpdates: context => {
      assert(context.team)
      context.team.addListener('updated', ({ head }) => {
        if (!this.machine.state.done) {
          this.machine.send({ type: 'LOCAL_UPDATE', payload: { head } }) // send update event to local machine
        }
      })
    },

    sendSyncMessage: context => {
      assert(context.team)
      const syncState = context.syncState ?? sync.initSyncState()

      const [newSyncState, syncMessage] = sync.generateMessage(context.team.chain, syncState)
      context.syncState = newSyncState
      if (syncMessage !== undefined) {
        this.sendMessage({
          type: 'SYNC',
          payload: syncMessage,
        })
      }
    },

    receiveSyncMessage: assign((context, event) => {
      assert(context.team)

      const chain = context.team.chain
      const oldSyncState = context.syncState ?? sync.initSyncState()
      const syncMessage = (event as SyncMessage).payload

      const [newChain, syncState] = sync.receiveMessage(chain, oldSyncState, syncMessage)
      const team = context.team.merge(newChain)

      return {
        ...context,
        syncState,
        team,
      }
    }),

    // negotiating

    generateSeed: assign({ seed: _ => randomKey() }),

    sendSeed: context => {
      assert(context.user)
      assert(context.peer)
      assert(context.seed)

      const recipientPublicKey = context.peer.keys.encryption
      const senderPublicKey = context.user.keys.encryption.publicKey
      const senderSecretKey = context.user.keys.encryption.secretKey
      this.log(`encrypting %o`, { recipientPublicKey, senderPublicKey })
      const encryptedSeed = asymmetric.encrypt({
        secret: context.seed,
        recipientPublicKey,
        senderSecretKey,
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
        const senderPublicKey = context.peer.keys.encryption
        const recipientPublicKey = context.user.keys.encryption.publicKey
        const recipientSecretKey = context.user.keys.encryption.secretKey
        this.log(`decrypting %o`, { senderPublicKey, recipientPublicKey })
        try {
          const theirSeed = asymmetric.decrypt({
            cipher: context.theirEncryptedSeed,
            senderPublicKey,
            recipientSecretKey,
          })

          // with the two keys, we derive a shared key
          return deriveSharedKey(ourSeed, theirSeed)
        } catch (e) {
          this.log(`decryption failed %o`, { senderPublicKey, recipientPublicKey })
          throw e
        }
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

    rejectIdentityProof: this.fail(() => {
      return `${this.userName} can't verify ${this.peerName}'s proof of identity.`
    }),

    failNeitherIsMember: this.fail(
      () => `${this.userName} can't connect with ${this.peerName} because neither one is a member.`
    ),

    rejectInvitation: this.fail(
      () => `This invitation didn't work. ${this.context.error?.message}`
    ),

    rejectTeam: this.fail(
      () =>
        `${this.userName} was admitted to a team by ${this.peerName}, but it isn't the team ${this.userName} was invited to.`
    ),

    failPeerWasRemoved: this.fail(() => `${this.peerName} was removed from the team.`),

    failTimeout: this.fail(() => `${this.userName}'s connection to ${this.peerName} timed out.`),

    // events for external listeners

    onConnected: () => this.emit('connected'),
    onJoined: () => this.emit('joined', this.team),
    onUpdated: () => this.emit('updated'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  // GUARDS

  /** These are referred to by name in `connectionMachine` (e.g. `cond: 'iHaveInvitation'`) */
  private readonly guards: Record<string, Condition> = {
    //
    // INVITATIONS

    iHaveInvitation: context => isInvitee(context) && !isMember(context),

    theyHaveInvitation: context => context.theyHaveInvitation === true,

    bothHaveInvitation: (...args) =>
      this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args),

    invitationProofIsValid: context => {
      assert(context.team)
      assert(context.theirProofOfInvitation)
      const validation = context.team.validateInvitation(context.theirProofOfInvitation)
      this.log(`invitation validation: %o`, validation)
      if (validation.isValid) {
        return true
      } else {
        this.context.error = validation.error
        return false
      }
    },

    joinedTheRightTeam: (context, event) => {
      // Make sure my invitation exists on the signature chain of the team I'm about to join.
      // This check prevents an attack in which a fake team pretends to accept my invitation.
      const team = this.rehydrateTeam(context, event)
      return team.hasInvitation(this.myProofOfInvitation(context))
    },

    // IDENTITY

    peerWasRemoved: context => {
      assert(context.team)
      assert(context.peer)
      return context.team.has(context.peer.userName) === false
    },

    identityProofIsValid: (context, event) => {
      assert(context.team)
      const { challenge, proof } = (event as ProveIdentityMessage).payload
      return context.team.verifyIdentityProof(challenge, proof)
    },

    // SYNCHRONIZATION

    headsAreEqual: (context, event) => {
      assert(context.team)
      const ourHead = context.team.chain.head
      if (event.type === 'SYNC') {
        const { head, need } = event.payload
        if (head !== ourHead) return false
        if (need) return false
        return true
      } else {
        return ourHead === context.syncState?.lastCommonHead
      }
    },

    headsAreDifferent: (...args) => {
      return !this.guards.headsAreEqual(...args)
    },
  }

  // helpers

  private logMessage = (direction: 'in' | 'out', message: ConnectionMessage, index: number) => {
    const arrow = direction === 'in' ? '<-' : '->'
    this.log(`${this.userName}${arrow}${this.peerName} #${index} ${messageSummary(message)}`)
  }

  private rehydrateTeam = (context: ConnectionContext, event: ConnectionMessage) => {
    return new Team({
      source: (event as AcceptInvitationMessage).payload.chain,
      context: { user: context.user!, device: context.device },
    })
  }

  private myProofOfInvitation = (context: ConnectionContext) => {
    assert(context.invitationSeed)
    return invitations.generateProof(context.invitationSeed)
  }
}

// for debugging

const messageSummary = (message: ConnectionMessage) =>
  // @ts-ignore
  `${message.type} ${message.payload?.head?.slice(0, 5) || message.payload?.message || ''}`

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

const isMember = (context: ConnectionContext) => context.team !== undefined
