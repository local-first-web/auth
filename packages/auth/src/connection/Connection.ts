import {
  generateMessage,
  headsAreEqual,
  initSyncState,
  receiveMessage,
  redactKeys,
  type DecryptFn,
  type DecryptFnParams,
  type Keyring,
  type SyncState,
  type UserWithSecrets,
} from '@localfirst/crdx'
import {
  asymmetric,
  randomKey,
  symmetric,
  type Base58,
  type Hash,
  type Payload,
} from '@localfirst/crypto'
import { deriveSharedKey } from 'connection/deriveSharedKey.js'
import {
  buildError,
  type ConnectionErrorType,
  type ErrorMessage,
  type LocalErrorMessage,
} from 'connection/errors.js'
import * as identity from 'connection/identity.js'
import {
  isNumberedConnectionMessage,
  type AcceptInvitationMessage,
  type ChallengeIdentityMessage,
  type ClaimIdentityMessage,
  type ConnectionMessage,
  type DisconnectMessage,
  type EncryptedMessage,
  type NumberedConnectionMessage,
  type ProveIdentityMessage,
  type SeedMessage,
  type SyncMessage,
} from 'connection/message.js'
import { orderedDelivery } from 'connection/orderedDelivery.js'
import { parseDeviceId, type Device, type DeviceWithSecrets, redactDevice } from 'device/index.js'
import { EventEmitter } from 'eventemitter3'
import * as invitations from 'invitation/index.js'
import { cast } from 'server/cast.js'
import { getTeamState } from 'team/getTeamState.js'
import { getUserForDeviceFromGraph } from 'team/getUserForDeviceFromGraph.js'
import {
  Team,
  decryptTeamGraph,
  type TeamAction,
  type TeamContext,
  type TeamGraph,
} from 'team/index.js'
import * as select from 'team/selectors/index.js'
import { arraysAreEqual } from 'util/arraysAreEqual.js'
import { KeyType, assert, debug, truncateHashes } from 'util/index.js'
import { syncMessageSummary } from 'util/testing/messageSummary.js'
import { assign, createMachine, interpret, type Interpreter } from 'xstate'
import { protocolMachine } from './protocolMachine.js'
import {
  isInvitee,
  type Condition,
  type ConnectionContext,
  type ConnectionEvents,
  type ConnectionParams,
  type ConnectionState,
  type SendFunction,
  type StateMachineAction,
} from './types.js'

const { DEVICE } = KeyType

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol. The XState configuration is in `protocolMachine`.
 */
export class Connection extends EventEmitter<ConnectionEvents> {
  private peerUserId = '?'

  private readonly sendFn: SendFunction
  private readonly machine: Interpreter<ConnectionContext, ConnectionState, ConnectionMessage>

  private incomingMessageQueue: Record<number, NumberedConnectionMessage> = {}
  private outgoingMessageIndex = 0
  private started = false

  log: (...args: any[]) => void = () => {}

  // ACTIONS

  /** These are referred to by name in `connectionMachine` (e.g. `actions: 'sendIdentityClaim'`) */
  private readonly actions: Record<string, StateMachineAction> = {
    sendIdentityClaim: async context => {
      const payload: ClaimIdentityMessage['payload'] =
        'team' in context
          ? // I'm already a member
            {
              identityClaim: {
                type: DEVICE,
                name: context.device.deviceId,
              },
            }
          : 'user' in context && context.user !== undefined
          ? // I'm a new user and I have an invitation
            {
              proofOfInvitation: this.myProofOfInvitation(context),
              userKeys: redactKeys(context.user.keys),
              device: redactDevice(context.device),
            }
          : // I'm a new device for an existing user and I have an invitation
            {
              proofOfInvitation: this.myProofOfInvitation(context),
              userName: context.userName!,
              device: redactDevice(context.device),
            }

      this.sendMessage({
        type: 'CLAIM_IDENTITY',
        payload,
      })
    },

    receiveIdentityClaim: assign({
      theirIdentityClaim: (_, event) => {
        event = event as ClaimIdentityMessage
        if ('identityClaim' in event.payload) return event.payload.identityClaim
        return undefined
      },

      theyHaveInvitation(_, event) {
        event = event as ClaimIdentityMessage
        if ('proofOfInvitation' in event.payload) return true
        return false
      },

      theirProofOfInvitation(_, event) {
        event = event as ClaimIdentityMessage
        if ('proofOfInvitation' in event.payload) {
          return event.payload.proofOfInvitation
        }

        return undefined
      },

      theirUserKeys(_, event) {
        event = event as ClaimIdentityMessage
        if ('userKeys' in event.payload) {
          return event.payload.userKeys
        }

        return undefined
      },

      theirDevice(_, event) {
        event = event as ClaimIdentityMessage
        if ('device' in event.payload) {
          return event.payload.device
        }

        return undefined
      },

      theirUserName(_, event) {
        event = event as ClaimIdentityMessage
        if ('userName' in event.payload) {
          return event.payload.userName
        }

        return undefined
      },
    }),

    // HANDLING INVITATIONS

    acceptInvitation: context => {
      assert(context.team)
      assert(context.theirProofOfInvitation)

      // Admit them to the team
      if ('theirUserKeys' in context && context.theirUserKeys !== undefined) {
        // New member
        context.team.admitMember(
          context.theirProofOfInvitation,
          context.theirUserKeys,
          context.theirUserName!
        )
      } else {
        // New device for existing member
        assert(context.theirDevice)

        context.team.admitDevice(context.theirProofOfInvitation, context.theirDevice)
      }

      // Welcome them by sending the team's signature chain, so they can reconstruct team membership state
      this.sendMessage({
        type: 'ACCEPT_INVITATION',
        payload: {
          serializedGraph: context.team.save(),
          teamKeyring: context.team.teamKeyring(),
        },
      } as AcceptInvitationMessage)
    },

    joinTeam: (context, event) => {
      assert(this.context.invitationSeed)

      const { serializedGraph, teamKeyring } = (event as AcceptInvitationMessage).payload
      const { user, device } = context
      // Join the team
      if (user === undefined) {
        // Joining as a new device for an existing member.
        // We don't know our user id or user keys yet, so we need to get those from the graph.
        const proofOfInvitation = this.myProofOfInvitation(context)
        const user = getUserForDeviceFromGraph({
          serializedGraph,
          keyring: teamKeyring,
          device,
          invitationId: proofOfInvitation.id,
        })

        // Now we can rehydrate the graph
        const team = this.rehydrateTeam(serializedGraph, user, device, teamKeyring)

        // Put the user and team on our context
        context.user = user
        context.team = team
      } else {
        // Joining as a new member

        // Reconstruct team from serialized graph
        const team = this.rehydrateTeam(serializedGraph, user, device, teamKeyring)
        // we add our current device to the team chain
        team.join(teamKeyring)

        // Put the updated team on our context
        context.team = team
      }
    },

    // AUTHENTICATING

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
      event = event as ClaimIdentityMessage

      // If we're not on the team yet, we don't have a way of knowing if the peer is
      if (context.team === undefined) return

      // If no identity claim is being made, there's nothing to confirm
      if (!('identityClaim' in event.payload) || event.payload.identityClaim === undefined) return

      const { identityClaim } = event.payload
      const deviceId = identityClaim.name

      const identityLookupResult = context.team.lookupIdentity(identityClaim)

      const fail = (type: ConnectionErrorType, message: string) => {
        context.error = this.throwError(type, () => message)
      }

      switch (identityLookupResult) {
        // If a member or a device was removed, we still connect with it in order to sync
        case 'MEMBER_REMOVED':
        case 'DEVICE_REMOVED':
        case 'VALID_DEVICE': {
          const device = context.team.device(deviceId, { includeRemoved: true })
          assert(device)
          this.peerUserId = device.userId
          return
        }

        case 'DEVICE_UNKNOWN': {
          fail('DEVICE_UNKNOWN', `Device ${deviceId} not found.`)
          break
        }
      }
    },

    challengeIdentity: assign({
      challenge: context => {
        this.log('challengeIdentity')
        assert(context.theirIdentityClaim)
        const identityClaim = context.theirIdentityClaim
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
        assert(this.peerUserId)
        if (context.team.hasServer(this.peerUserId)) {
          const server = context.team.servers(this.peerUserId)
          // Return synthetic member
          return cast.toMember(server)
        }

        return context.team.members(this.peerUserId, { includeRemoved: true })
      },
    }),

    acceptIdentity: () => {
      this.sendMessage({
        type: 'ACCEPT_IDENTITY',
        payload: {},
      })
    },

    // UPDATING

    listenForTeamUpdates: context => {
      assert(context.team)
      context.team.addListener('updated', ({ head }: { head: Hash[] }) => {
        if (!this.machine.state.done) {
          this.machine.send({ type: 'LOCAL_UPDATE', payload: { head } }) // Send update event to local machine
        }
      })
    },

    sendSyncMessage: assign({
      syncState: context => {
        assert(context.team)
        const syncState = this.sendSyncMessage(context.team.graph, context.syncState)
        return syncState
      },
    }),

    receiveSyncMessage: assign((context, event) => {
      assert(context.team)
      let { team } = context

      const previousSyncState = context.syncState ?? initSyncState()
      const syncMessage = (event as SyncMessage).payload

      const teamKeys = team.teamKeys()

      this.log(`receiving message with team keys generation ${teamKeys.generation}`)

      const decrypt = (({ encryptedGraph, keys }: DecryptFnParams<TeamAction, TeamContext>) => {
        const graph = decryptTeamGraph({
          encryptedGraph,
          teamKeys: keys,
          deviceKeys: context.device.keys,
        })
        return graph
      }) as DecryptFn

      const [newChain, syncState] = receiveMessage(
        context.team.graph,
        previousSyncState,
        syncMessage,
        team.teamKeys(),
        decrypt
      )

      if (!headsAreEqual(newChain.head, team.graph.head)) {
        team = context.team.merge(newChain)

        const summary = JSON.stringify({
          head: team.graph.head,
          links: Object.keys(team.graph.links),
        })
        this.log(`received sync message; new chain ${summary}`)
        this.emit('updated')
      }

      return { team, syncState }
    }),

    // NEGOTIATING

    generateSeed: assign({ seed: _ => randomKey() }),

    sendSeed: context => {
      assert(context.user)
      assert(context.peer)
      assert(context.seed)

      const recipientPublicKey = context.peer.keys.encryption
      const senderPublicKey = context.user.keys.encryption.publicKey
      const senderSecretKey = context.user.keys.encryption.secretKey
      this.log('encrypting %o', { recipientPublicKey, senderPublicKey })
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
      theirEncryptedSeed: (_, event) => (event as SeedMessage).payload.encryptedSeed,
    }),

    deriveSharedKey: assign({
      sessionKey: context => {
        assert(context.user)
        assert(context.theirEncryptedSeed)
        assert(context.seed)
        assert(context.peer)

        // We saved our seed in context
        const ourSeed = context.seed

        // Their seed is encrypted and stored in context
        const senderPublicKey = context.peer.keys.encryption
        const recipientPublicKey = context.user.keys.encryption.publicKey
        const recipientSecretKey = context.user.keys.encryption.secretKey
        this.log('decrypting %o', truncateHashes({ senderPublicKey, recipientPublicKey }))
        try {
          const theirSeed = asymmetric.decrypt({
            cipher: context.theirEncryptedSeed,
            senderPublicKey,
            recipientSecretKey,
          }) as Base58

          // With the two keys, we derive a shared key
          return deriveSharedKey(ourSeed, theirSeed)
        } catch (error: unknown) {
          this.log('decryption failed %o', truncateHashes({ senderPublicKey, recipientPublicKey }))
          throw error
        }
      },
    }),

    // COMMUNICATING

    receiveEncryptedMessage: (context, event) => {
      assert(context.sessionKey)
      const encryptedMessage = (event as EncryptedMessage).payload
      const decryptedMessage = symmetric.decrypt(encryptedMessage, context.sessionKey)
      this.emit('message', decryptedMessage)
    },

    // FAILURE

    receiveError: assign({
      error: (_, event) => {
        const error = (event as ErrorMessage).payload
        this.log('receiveError %o', error)

        // Bubble the error up
        this.emit('remoteError', error)

        // Store the error in context
        return error
      },
    }),

    sendError: assign({
      error: (_, event) => {
        const error = (event as LocalErrorMessage).payload
        this.log('sendError %o', error)

        // Send error to peer
        const remoteMessage = buildError(error.type, error.details, 'REMOTE')
        this.sendMessage(remoteMessage)

        // Bubble the error up
        this.emit('localError', error)

        // Store the error in context
        return error
      },
    }),

    rejectIdentityProof: this.fail('IDENTITY_PROOF_INVALID'),
    failNeitherIsMember: this.fail('NEITHER_IS_MEMBER'),
    rejectInvitation: this.fail('INVITATION_PROOF_INVALID'),
    rejectTeam: this.fail('JOINED_WRONG_TEAM'),
    failPeerWasRemoved: this.fail('MEMBER_REMOVED'),
    failTimeout: this.fail('TIMEOUT'),

    // EVENTS FOR EXTERNAL LISTENERS

    onConnected: () => this.emit('connected'),
    onJoined: () => this.emit('joined', { team: this.team!, user: this.user! }),
    onUpdated: () => this.emit('updated'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  // GUARDS

  /** These are referred to by name in `connectionMachine` (e.g. `cond: 'iHaveInvitation'`) */
  private readonly guards: Record<string, Condition> = {
    //
    // INVITATIONS

    iHaveInvitation: context => isInvitee(context) && !isMember(context),

    theyHaveInvitation: context => context.theyHaveInvitation!,

    bothHaveInvitation: (...args) =>
      this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args),

    invitationProofIsValid: context => {
      assert(context.team)
      assert(context.theirProofOfInvitation)
      const validation = context.team.validateInvitation(context.theirProofOfInvitation)
      this.log('invitation validation: %o', validation)
      if (validation.isValid) {
        return true
      }

      context.error = validation.error
      return false
    },

    joinedTheRightTeam: (context, event) => {
      // Make sure my invitation exists on the signature chain of the team I'm about to join.
      // This check prevents an attack in which a fake team pretends to accept my invitation.
      // TODO: cover with test
      const { serializedGraph, teamKeyring } = (event as AcceptInvitationMessage).payload

      const state = getTeamState(serializedGraph, teamKeyring)
      const { id } = this.myProofOfInvitation(context)
      return select.hasInvitation(state, id)
    },

    // IDENTITY

    // TODO: this is checking our device and userId, not our peer's???
    peerWasRemoved(context) {
      return false
      // assert(context.team)
      // assert(context.device)
      // const { team, device } = context
      // const { userId, deviceName } = device
      // const serverWasRemoved = team.serverWasRemoved(userId)
      // const memberWasRemoved = team.memberWasRemoved(userId)
      // const deviceWasRemoved = team.deviceWasRemoved(userId, deviceName)
      // return memberWasRemoved || deviceWasRemoved
    },

    identityProofIsValid(context, event) {
      assert(context.team)
      const { challenge, proof } = (event as ProveIdentityMessage).payload
      return context.team.verifyIdentityProof(challenge, proof)
    },

    // SYNCHRONIZATION

    headsAreEqual(context) {
      assert(context.team)
      const ourHead = context.team.graph.head
      const lastCommonHead = context.syncState?.lastCommonHead
      return arraysAreEqual(ourHead, lastCommonHead)
    },

    headsAreDifferent: (...args) => !this.guards.headsAreEqual(...args),
  }

  constructor({ sendMessage, context, peerUserId }: ConnectionParams) {
    super()

    if (peerUserId) {
      this.peerUserId = peerUserId
    }

    this.sendFn = sendMessage

    this.setLogPrefix(context as ConnectionContext)

    // Define state machine
    const machineConfig = { actions: this.actions, guards: this.guards }
    const machine = createMachine(protocolMachine, machineConfig) //
      .withContext(context as ConnectionContext)

    // Instantiate the machine
    this.machine = interpret(machine) as Interpreter<
      ConnectionContext,
      ConnectionState,
      ConnectionMessage,
      { value: any; context: ConnectionContext }
    >

    // Emit and log transitions
    this.machine.onTransition((state, event) => {
      const summary = stateSummary(state.value as string)
      this.emit('change', summary)
      this.log(`${messageSummary(event)} ⏩ ${summary} `)
    })
  }

  /** Starts (or restarts) the protocol machine. Returns this Protocol object. */
  public start = (storedMessages: string[] = []) => {
    this.log('starting')
    if (this.started) {
      this.machine.send({ type: 'RECONNECT' })
    } else {
      this.machine.start()
      this.started = true
      this.sendMessage({ type: 'REQUEST_IDENTITY' })

      // Deliver any stored messages we might have received before starting
      for (const m of storedMessages) {
        void this.deliver(m)
      }
    }

    return this
  }

  /** Sends a disconnect message to the peer. */
  public stop = () => {
    if (this.started && !this.machine.state.done) {
      const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
      this.sendMessage(disconnectMessage) // Send disconnect message to peer
      this.machine.send(disconnectMessage) // Send disconnect event to local machine
    }

    this.removeAllListeners()
    this.machine.stop()
    this.machine.state.done = true
    this.log('machine stopped: %o', this.machine.state.done)
    return this
  }

  /** Returns the local user's name. */
  get userId() {
    if (!this.started) return '(not started)'

    return 'user' in this.context && this.context.user !== undefined
      ? this.context.user.userId
      : 'unknown'
  }

  /** Returns the current state of the protocol machine. */
  get state() {
    if (!this.started) {
      return 'disconnected'
    }

    return this.machine.state.value
  }

  get context(): ConnectionContext {
    if (!this.started) {
      throw new Error("Can't get context; machine not started")
    }

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
    if (!this.started) {
      return '(not started)'
    }

    const peerUserId = this.context.peer?.userId ?? this.context.theirIdentityClaim?.name ?? '?'
    return trimUserId(peerUserId)
  }

  /** Sends an encrypted message to the peer we're connected with */
  public send = (message: Payload) => {
    assert(this.context.sessionKey)

    const encryptedMessage = symmetric.encrypt(message, this.context.sessionKey)
    this.sendMessage({ type: 'ENCRYPTED_MESSAGE', payload: encryptedMessage })
  }

  public sendSyncMessage(chain: TeamGraph, previousSyncState: SyncState = initSyncState()) {
    const [syncState, syncMessage] = generateMessage(chain, previousSyncState)

    // Undefined message means we're already synced
    if (syncMessage) {
      this.log('sending sync message', syncMessageSummary(syncMessage))
      this.sendMessage({ type: 'SYNC', payload: syncMessage })
    } else {
      this.log('no sync message to send')
    }

    return syncState
  }

  /** Passes an incoming message from the peer on to this protocol machine, guaranteeing that
   *  messages will be delivered in the intended order (according to the `index` field on the message) */
  public async deliver(serializedMessage: string) {
    const message = insistentlyParseJson(serializedMessage) as ConnectionMessage
    assert(
      isNumberedConnectionMessage(message),
      `Can only deliver numbered connection messages; received 
      ${JSON.stringify(message, null, 2)}`
    )

    this.logMessage('in', message, message.index)

    const { queue, nextMessages } = orderedDelivery(this.incomingMessageQueue, message)

    // Update queue
    this.incomingMessageQueue = queue

    // TODO: detect hang when we've got message N+1 and message N doesn't come in for a while?

    // send any messages that are ready to go out
    for (const m of nextMessages) {
      if (this.started && !this.machine.state.done) {
        this.log(`delivering #${m.index} from ${this.peerName}`)
        this.machine.send(m)
      } else {
        this.log(`stopped, not delivering #${m.index}`)
      }
    }
  }

  // HELPERS

  private readonly sendMessage = (message: ConnectionMessage) => {
    // Add a sequential index to any outgoing messages
    const index = this.outgoingMessageIndex++
    const messageWithIndex = { ...message, index }
    this.logMessage('out', message, index)
    this.sendFn(JSON.stringify(messageWithIndex))
  }

  private readonly throwError = (type: ConnectionErrorType, details?: any) => {
    const detailedMessage =
      details && 'message' in details ? (details.message as string) : undefined
    // Force error state locally
    const localMessage = buildError(type, detailedMessage, 'LOCAL')
    this.machine.send(localMessage)

    return localMessage.payload
  }

  // TODO: This business with storing the error in context and then retrieving it and using it as details and storing something else in context.error is pretty gross
  private fail(type: ConnectionErrorType) {
    return assign<ConnectionContext, ConnectionMessage>({
      error: context => {
        const details = context.error
        return this.throwError(type, details)
      },
    })
  }

  private logMessage(direction: 'in' | 'out', message: ConnectionMessage, index: number) {
    const arrow = direction === 'in' ? '<-' : '->'

    const userName = trimUserId(this.userId)
    this.log(`${userName}${arrow}${this.peerName} #${index} ${messageSummary(message)}`)
  }

  private rehydrateTeam(
    serializedGraph: string,
    user: UserWithSecrets,
    device: DeviceWithSecrets,
    teamKeyring: Keyring
  ) {
    return new Team({
      source: serializedGraph,
      context: { user, device },
      teamKeyring,
    })
  }

  private myProofOfInvitation(context: ConnectionContext) {
    assert(context.invitationSeed)
    return invitations.generateProof(context.invitationSeed)
  }

  private setLogPrefix(context: ConnectionContext) {
    const userName = trimUserId(context.device.keys.name)
    const peerUserName = trimUserId(this.peerUserId)
    this.log = debug(`lf:auth:connection:${userName}:${peerUserName}`)
  }
}

const isMember = (context: ConnectionContext) => context.team !== undefined

const insistentlyParseJson = (json: unknown) => {
  let result = json
  while (typeof result === 'string') {
    result = JSON.parse(result)
  }

  return result
}

const trimUserId = (userId?: string) => userId?.split('-')[0]

// FOR DEBUGGING

const messageSummary = (message: ConnectionMessage) =>
  message.type === 'SYNC'
    ? `SYNC ${syncMessageSummary(message.payload)}`
    : `${message.type} ${
        // @ts-expect-error utility function don't worry about it
        message.payload?.head?.slice(0, 5) || message.payload?.message || ''
      }`

const isString = (state: any): state is string => typeof state === 'string'

const stateSummary = (state = 'disconnected'): string =>
  isString(state)
    ? state === 'done'
      ? ''
      : state
    : Object.keys(state)
        .map(key => `${key}:${stateSummary(state[key])}`)
        .filter(s => s.length)
        .join(',')
