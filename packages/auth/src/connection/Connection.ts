/* eslint-disable object-shorthand */

import {
  generateMessage,
  headsAreEqual,
  initSyncState,
  receiveMessage,
  redactKeys,
  type DecryptFnParams,
  type SyncState,
} from '@localfirst/crdx'
import { asymmetric, randomKey, symmetric, type Hash, type Payload } from '@localfirst/crypto'
import { deriveSharedKey } from 'connection/deriveSharedKey.js'
import {
  buildError,
  type ConnectionErrorType,
  type ErrorMessage,
  type LocalErrorMessage,
} from 'connection/errors.js'
import { getDeviceUserFromGraph } from 'connection/getDeviceUserFromGraph.js'
import * as identity from 'connection/identity.js'
import {
  type AcceptInvitationMessage,
  type ChallengeIdentityMessage,
  type ClaimIdentityMessage,
  type ConnectionMessage,
  type DisconnectMessage,
  type EncryptedMessage,
  type ProveIdentityMessage,
  type SeedMessage,
  type SyncMessage,
} from 'connection/message.js'
import { redactDevice } from 'device/index.js'
import { EventEmitter } from 'eventemitter3'
import * as invitations from 'invitation/index.js'
import { getTeamState } from 'team/getTeamState.js'
import {
  Team,
  decryptTeamGraph,
  type TeamAction,
  type TeamContext,
  type TeamGraph,
} from 'team/index.js'
import * as select from 'team/selectors/index.js'
import { arraysAreEqual } from 'util/arraysAreEqual.js'
import { KeyType, assert, debug } from 'util/index.js'
import { syncMessageSummary } from 'util/testing/messageSummary.js'
import { assign, createMachine, interpret, type Interpreter } from 'xstate'
import { NumberedMessage, OrderedNetwork } from './OrderedNetwork.js'
import { machine } from './machine.js'
import type {
  Condition,
  ConnectionContext,
  ConnectionEvents,
  ConnectionState,
  Context,
  IdentityClaim,
  ServerContext,
  StateMachineAction,
} from './types.js'
import {
  isInviteeClaim,
  isInviteeContext,
  isInviteeDeviceContext,
  isInviteeMemberClaim,
  isInviteeMemberContext,
  isMemberClaim,
  isMemberContext,
  isServerContext,
} from './types.js'
import { pack, unpack } from 'msgpackr'

const { DEVICE } = KeyType

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol.
 */
export class Connection extends EventEmitter<ConnectionEvents> {
  /** The interpreted state machine. Its XState configuration is in `machine.ts`. */
  private readonly machine: Interpreter<ConnectionContext, ConnectionState, ConnectionMessage>
  private started = false
  private orderedNetwork: OrderedNetwork<ConnectionMessage>
  private log = debug.extend('connection')

  constructor({ sendMessage, context }: Params) {
    super()

    // To send messages to our peer, we give them to the ordered network,
    // which will deliver them using the
    this.orderedNetwork = new OrderedNetwork<ConnectionMessage>({
      sendMessage: message => {
        this.logMessage('out', message)
        const serialized = pack(message)
        sendMessage(serialized)
      },
    })

    // When we receive a message from our peer, pass it to the state machine
    this.orderedNetwork.on('message', message => {
      this.machine.send(message)
    })

    const userName =
      'server' in context
        ? context.server.host
        : 'userName' in context
        ? context.userName
        : 'user' in context
        ? context.user.userName
        : // ignore coverage
          ''
    this.log = this.log.extend(userName)

    const Context: Context = isServerContext(context) ? extendServerContext(context) : context

    // Instantiate the state machine
    this.machine = interpret(
      createMachine(machine, { actions: this.actions, guards: this.guards }) //
        .withContext(Context as ConnectionContext)
    )
      // emit and log all transitions
      .onTransition((state, event) => {
        const summary = stateSummary(state.value as string)
        this.emit('change', summary)
        this.log(`${messageSummary(event)} ⏩ ${summary} `)
      })
  }

  // PUBLIC API

  /** Starts the protocol machine. Returns this Protocol object. */
  public start = (storedMessages: string[] = []) => {
    this.log('starting')
    this.machine.start()
    this.orderedNetwork.start()
    this.started = true

    // kick off the connection by requesting our peer's identity
    this.sendMessage({ type: 'REQUEST_IDENTITY' })

    // TODO: test with messages received before starting

    // Process any stored messages we might have received before starting
    for (const m of storedMessages) this.deliver(m)

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
    this.orderedNetwork.stop()
    this.machine.stop()
    this.machine.state.done = true
    this.log('machine stopped')
    return this
  }

  /** Returns the current state of the protocol machine. */
  public get state() {
    if (!this.started) return 'not started'

    return this.machine.state.value
  }

  public get context(): ConnectionContext {
    if (!this.started) throw new Error("Can't get context; machine not started")
    return this.machine.state.context
  }

  public get user() {
    return this.context.user
  }

  /**
   * Returns the last error encountered by the protocol machine.
   * If no error has occurred, returns undefined.
   */
  public get error() {
    return this.context.error
  }

  /**
   * Returns the team that the connection's user is a member of.
   * If the user has not yet joined a team, returns undefined.
   */
  public get team() {
    return this.context.team
  }

  /**
   * Returns the connection's session key when we are in a connected state.
   * Otherwise, returns `undefined`.
   */
  public get sessionKey() {
    return this.context.sessionKey
  }

  public get peer() {
    return this.context.peer
  }

  // TODO: should this be private?

  /** Generates and sends a sync message to our peer */
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

  // TODO: should this be private?

  /**
   * Adds incoming messages from the peer to the OrderedNetwork's incoming message queue, which will
   * pass them to the state machine in order.
   */
  public deliver(serializedMessage: Uint8Array) {
    const message = unpack(serializedMessage) as NumberedMessage<ConnectionMessage>
    this.logMessage('in', message)
    this.orderedNetwork.receive(message)
  }

  /** Sends an encrypted message to our peer. */
  public send = (message: Payload) => {
    const { sessionKey } = this.context
    assert(sessionKey)
    const encryptedMessage = symmetric.encrypt(message, sessionKey)
    this.sendMessage({ type: 'ENCRYPTED_MESSAGE', payload: encryptedMessage })
  }

  // ACTIONS

  /** These are referred to by name in `connectionMachine` (e.g. `actions: 'sendIdentityClaim'`) */
  private readonly actions: Record<string, StateMachineAction> = {
    sendIdentityClaim: assign(context => {
      const createIdentityClaim = (context: ConnectionContext): IdentityClaim => {
        if (isMemberContext(context)) {
          // I'm already a member
          return {
            deviceId: context.device.deviceId,
          }
        }
        if (isInviteeMemberContext(context)) {
          // I'm a new user and I have an invitation
          const { userName, keys } = context.user
          return {
            proofOfInvitation: this.myProofOfInvitation(context),
            userName,
            userKeys: redactKeys(keys),
            device: redactDevice(context.device),
          }
        }
        if (isInviteeDeviceContext(context)) {
          // I'm a new device for an existing user and I have an invitation
          const { userName, device } = context
          return {
            proofOfInvitation: this.myProofOfInvitation(context),
            userName,
            device: redactDevice(device),
          }
        }
        // ignore coverage - that should have been exhaustive
        throw new Error('Invalid context')
      }

      const ourIdentityClaim = createIdentityClaim(context)
      this.sendMessage({
        type: 'CLAIM_IDENTITY',
        payload: ourIdentityClaim,
      })

      return { ourIdentityClaim }
    }),

    receiveIdentityClaim: assign((_, event) => {
      const { payload } = event as ClaimIdentityMessage
      if ('userName' in payload) this.log = this.log.extend(payload.userName)

      return {
        theirIdentityClaim: payload,
        theirDevice: 'device' in payload ? payload.device : undefined,
      }
    }),

    // HANDLING INVITATIONS

    acceptInvitation: assign(context => {
      // Admit them to the team
      const { team, theirIdentityClaim } = context

      assert(team)
      assert(theirIdentityClaim)
      assert(isInviteeClaim(theirIdentityClaim))

      const { proofOfInvitation } = theirIdentityClaim

      const admit = () => {
        if (isInviteeMemberClaim(theirIdentityClaim)) {
          // New member
          const { userName, userKeys } = theirIdentityClaim
          assert(userName)
          team.admitMember(proofOfInvitation, userKeys, userName)
          const userId = userKeys.name
          return team.members(userId)
        } else {
          // New device for existing member
          const { device } = theirIdentityClaim
          team.admitDevice(proofOfInvitation, device)
          const { deviceId } = device
          const { userId } = team.memberByDeviceId(deviceId)
          return team.members(userId)
        }
      }
      const peer = admit()

      // Welcome them by sending the team's signature chain, so they can reconstruct team membership state
      this.sendMessage({
        type: 'ACCEPT_INVITATION',
        payload: {
          serializedGraph: team.save(),
          teamKeyring: team.teamKeyring(),
        },
      })

      return { peer }
    }),

    joinTeam: assign((context, event) => {
      const { payload } = event as AcceptInvitationMessage
      const { serializedGraph, teamKeyring } = payload
      const { device, invitationSeed } = context

      // We've been given the serialized and encrypted graph, and the team keyring. We can decrypt
      // the graph and reconstruct the team.

      const getDeviceUser = () => {
        // If we're joining as a new device for an existing member, we don't know our user id or
        // user keys yet, so we need to get those from the graph.
        const { id: invitationId } = this.myProofOfInvitation(context)

        // We use the invitation seed to generate the starter keys for the new device.
        // We can use these to unlock a lockbox on the team graph that contains our user keys.
        const starterKeys = invitations.generateStarterKeys(invitationSeed!)
        return getDeviceUserFromGraph({
          serializedGraph,
          teamKeyring,
          starterKeys,
          invitationId,
        })
      }
      const user = context.user ?? getDeviceUser()

      // Reconstruct team from serialized graph
      const team = new Team({ source: serializedGraph, context: { user, device }, teamKeyring })

      // Add our current device to the team chain
      team.join(teamKeyring)

      return { user, team }
    }),

    // AUTHENTICATING

    confirmIdentityExists: assign(context => {
      const { team, theirIdentityClaim } = context
      assert(theirIdentityClaim)
      assert(team) // If we're not on the team yet, we don't have a way of knowing if the peer is
      assert(isMemberClaim(theirIdentityClaim)) // This is only for members authenticating witih deviceId

      const { deviceId } = theirIdentityClaim

      try {
        const device = team.device(deviceId, { includeRemoved: true })
        const user = team.memberByDeviceId(deviceId, { includeRemoved: true })

        this.log = this.log.extend(user.userName)

        return {
          theirDevice: device,
          peer: user,
        }
      } catch {
        return {
          error: this.throwError('DEVICE_UNKNOWN', { message: `Device ${deviceId} not found.` }),
        }
      }
    }),

    challengeIdentity: assign(context => {
      const { theirIdentityClaim } = context
      assert(theirIdentityClaim)
      assert(isMemberClaim(theirIdentityClaim))
      const { deviceId } = theirIdentityClaim
      const challenge = identity.challenge({ type: DEVICE, name: deviceId })
      this.sendMessage({
        type: 'CHALLENGE_IDENTITY',
        payload: { challenge },
      })
      return { challenge }
    }),

    proveIdentity: (context, event) => {
      assert(context.user)
      const { challenge } = (event as ChallengeIdentityMessage).payload
      const proof = identity.prove(challenge, context.device.keys)
      this.sendMessage({
        type: 'PROVE_IDENTITY',
        payload: { challenge, proof },
      })
    },

    acceptIdentity: () => {
      this.sendMessage({ type: 'ACCEPT_IDENTITY' })
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

    sendSyncMessage: assign(context => {
      assert(context.team)
      const previousSyncState = context.syncState ?? initSyncState()

      const [syncState, syncMessage] = generateMessage(context.team.graph, previousSyncState)

      // Undefined message means we're already synced
      if (syncMessage) {
        this.log('sending sync message', syncMessageSummary(syncMessage))
        this.sendMessage({ type: 'SYNC', payload: syncMessage })
      } else {
        this.log('no sync message to send')
      }

      return { syncState }
    }),

    receiveSyncMessage: assign((context, event) => {
      const { team, device } = context
      assert(team)

      const previousSyncState = context.syncState ?? initSyncState()
      const syncMessage = (event as SyncMessage).payload

      const teamKeys = team.teamKeys()
      const deviceKeys = device.keys

      const decrypt = ({ encryptedGraph, keys }: DecryptFnParams<TeamAction, TeamContext>) =>
        decryptTeamGraph({ encryptedGraph, teamKeys: keys, deviceKeys })

      const [newChain, syncState] = receiveMessage(
        team.graph,
        previousSyncState,
        syncMessage,
        teamKeys,
        decrypt
      )

      if (headsAreEqual(newChain.head, team.graph.head))
        // no update
        return { syncState }

      this.emit('updated')

      const newTeam = team.merge(newChain)
      return { team: newTeam, syncState }
    }),

    // NEGOTIATING

    generateSeed: assign(context => {
      return {
        seed: randomKey(),
      }
    }),

    sendSeed: context => {
      const { user, peer, seed } = context

      const encryptedSeed = asymmetric.encrypt({
        secret: seed!,
        recipientPublicKey: peer!.keys.encryption,
        senderSecretKey: user!.keys.encryption.secretKey,
      })

      this.sendMessage({
        type: 'SEED',
        payload: { encryptedSeed },
      })
    },

    receiveSeed: assign((_, event) => {
      const { payload } = event as SeedMessage
      return {
        theirEncryptedSeed: payload.encryptedSeed,
      }
    }),

    deriveSharedKey: assign({
      sessionKey: context => {
        const { user, seed, theirEncryptedSeed, peer } = context

        // We saved our seed in context
        assert(seed)

        // Their encrypted seed is stored in context
        assert(theirEncryptedSeed)
        // Decrypt it:
        const theirSeed = asymmetric.decrypt({
          cipher: theirEncryptedSeed,
          senderPublicKey: peer!.keys.encryption,
          recipientSecretKey: user!.keys.encryption.secretKey,
        })

        // With the two keys, we derive a shared key
        return deriveSharedKey(seed, theirSeed)
      },
    }),

    // COMMUNICATING

    receiveEncryptedMessage: (context, event) => {
      const { sessionKey } = context
      assert(sessionKey)
      const { payload: encryptedMessage } = event as EncryptedMessage
      const decryptedMessage = symmetric.decrypt(encryptedMessage, sessionKey)
      this.emit('message', decryptedMessage)
    },

    // FAILURE

    receiveError: assign((_, event) => {
      const error = (event as ErrorMessage).payload
      this.log('receiveError %o', error)

      // Bubble the error up
      this.emit('remoteError', error)

      // Store the error in context
      return { error }
    }),

    sendError: assign((_, event) => {
      const error = (event as LocalErrorMessage).payload
      this.log('sendError %o', error)

      // Send error to peer
      const remoteMessage = buildError(error.type, error.details, 'REMOTE')
      this.sendMessage(remoteMessage)

      // Bubble the error up
      this.emit('localError', error)

      // Store the error in context
      return { error }
    }),

    rejectIdentityProof: this.fail('IDENTITY_PROOF_INVALID'),
    failNeitherIsMember: this.fail('NEITHER_IS_MEMBER'),
    rejectInvitation: this.fail('INVITATION_PROOF_INVALID'),
    rejectTeam: this.fail('JOINED_WRONG_TEAM'),
    failPeerWasRemoved: this.fail('MEMBER_REMOVED'),
    failDeviceWasRemoved: this.fail('DEVICE_REMOVED'),
    failTimeout: this.fail('TIMEOUT'),

    // EVENTS FOR EXTERNAL LISTENERS

    onConnected: () => this.emit('connected'),
    onJoined: () => this.emit('joined', { team: this.team!, user: this.user! }),
    onUpdated: () => this.emit('updated'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  // GUARDS

  /** These are referred to by name in `connectionMachine` (e.g. `cond: 'weHaveInvitation'`) */
  private readonly guards: Record<string, Condition> = {
    // INVITATIONS

    weHaveInvitation: context => isInviteeContext(context),

    theyHaveInvitation: context => isInviteeClaim(context.theirIdentityClaim!),

    bothHaveInvitation: (...args) => {
      const weHaveInvitation = this.guards.weHaveInvitation(...args)
      const theyHaveInvitation = this.guards.theyHaveInvitation(...args)
      return weHaveInvitation && theyHaveInvitation
    },

    invitationProofIsValid: context => {
      const { team, theirIdentityClaim } = context
      assert(team)
      assert(theirIdentityClaim)
      assert(isInviteeClaim(theirIdentityClaim))
      const { proofOfInvitation } = theirIdentityClaim
      const validation = team.validateInvitation(proofOfInvitation)
      if (validation.isValid) return true
      context.error = validation.error
      return false
    },

    joinedTheRightTeam: (context, event) => {
      // Make sure my invitation exists on the signature chain of the team I'm about to join.
      // This check prevents an attack in which a fake team pretends to accept my invitation.
      const { payload } = event as AcceptInvitationMessage
      const { serializedGraph, teamKeyring } = payload
      const state = getTeamState(serializedGraph, teamKeyring)
      const { id } = this.myProofOfInvitation(context)
      return select.hasInvitation(state, id)
    },

    // IDENTITY

    bothSentIdentityClaim: context => {
      return context.ourIdentityClaim !== undefined && context.theirIdentityClaim !== undefined
    },

    identityProofIsValid(context, event) {
      const { team } = context
      assert(team)
      const { payload } = event as ProveIdentityMessage
      const { challenge, proof } = payload
      return team.verifyIdentityProof(challenge, proof)
    },

    peerWasRemoved(context) {
      const { team, peer, theirDevice } = context
      assert(team)
      assert(peer)
      assert(theirDevice)
      const serverWasRemoved = team.serverWasRemoved(peer.userId)
      const memberWasRemoved = team.memberWasRemoved(peer.userId)
      const deviceWasRemoved = team.deviceWasRemoved(theirDevice.deviceId)
      return serverWasRemoved || memberWasRemoved || deviceWasRemoved
    },

    // SYNCHRONIZATION

    headsAreEqual(context) {
      const { team, syncState } = context
      assert(team)
      const ourHead = team.graph.head
      const lastCommonHead = syncState?.lastCommonHead
      return arraysAreEqual(ourHead, lastCommonHead)
    },

    headsAreDifferent: (...args) => !this.guards.headsAreEqual(...args),
  }

  // PRIVATE

  private readonly sendMessage = (message: ConnectionMessage) => {
    this.orderedNetwork.send(message)
  }

  private readonly throwError = (type: ConnectionErrorType, details?: any) => {
    const detailedMessage =
      details && 'message' in details ? (details.message as string) : undefined
    // Force error state locally
    const localMessage = buildError(type, detailedMessage, 'LOCAL')
    this.machine.send(localMessage)

    return localMessage.payload
  }

  private fail(type: ConnectionErrorType) {
    return assign<ConnectionContext, ConnectionMessage>({
      error: context => {
        const details = context.error
        return this.throwError(type, details)
      },
    })
  }

  private logMessage(direction: 'in' | 'out', message: NumberedMessage<ConnectionMessage>) {
    const arrow = direction === 'in' ? '<-' : '->'
    const peerUserName = this.started ? this.context.peer?.userName ?? '?' : '?'
    this.log(`${arrow}${peerUserName} #${message.index} ${messageSummary(message)}`)
  }

  private myProofOfInvitation(context: ConnectionContext) {
    assert(context.invitationSeed)
    return invitations.generateProof(context.invitationSeed)
  }
}

const currentUserIsMember = (context: ConnectionContext) => context.team !== undefined

// FOR DEBUGGING

const messageSummary = (message: ConnectionMessage) =>
  message.type === 'SYNC'
    ? `SYNC ${syncMessageSummary(message.payload)}`
    : // @ts-expect-error utility function don't worry about it
      `${message.type} ${message.payload?.head?.slice(0, 5) || message.payload?.message || ''}`

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

export type Params = {
  /** A function to send messages to our peer. This how you hook this up to your network stack. */
  sendMessage: (message: Uint8Array) => void

  /** The initial context. */
  context: Context
}

/**
 * A server is conceptually kind of a user and kind of a device. This little hack lets us avoid
 * creating special logic for servers all over the place.
 */
const extendServerContext = (context: ServerContext) => {
  const { keys, host } = context.server
  return {
    ...context,
    user: { userId: host, userName: host, keys },
    device: { userId: host, deviceId: host, deviceName: host, keys },
  }
}
