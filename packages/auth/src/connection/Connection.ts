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
import { redactDevice } from 'device/index.js'
import { EventEmitter } from 'eventemitter3'
import * as invitations from 'invitation/index.js'
import { getTeamState } from 'team/getTeamState.js'
import { getDeviceUserFromGraph } from 'connection/getDeviceUserFromGraph.js'
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
import { machine } from './machine.js'
import type {
  Condition,
  ConnectionContext,
  ConnectionEvents,
  ConnectionState,
  InitialContext,
  SendFunction,
  ServerInitialContext,
  StateMachineAction,
} from './types.js'
import { isInvitee, isInviteeDevice, isInviteeMember, isServer } from './types.js'

const { DEVICE } = KeyType

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol. The XState configuration is in `protocolMachine`.
 */
export class Connection extends EventEmitter<ConnectionEvents> {
  private readonly sendFn: SendFunction
  private readonly machine: Interpreter<ConnectionContext, ConnectionState, ConnectionMessage>

  private incomingMessageQueue: Record<number, NumberedConnectionMessage> = {}
  private outgoingMessageIndex = 0
  private started = false

  log: debug.Debugger = debug.extend('connection')

  constructor({ sendMessage, context }: Params) {
    super()

    this.sendFn = sendMessage

    const initialContext: InitialContext = isServer(context)
      ? extendServerContext(context)
      : context

    const userName =
      'userName' in initialContext
        ? initialContext.userName
        : 'user' in initialContext
        ? initialContext.user.userName
        : ''
    this.log = this.log.extend(userName)

    // Instantiate the state machine
    this.machine = interpret(
      createMachine(machine, { actions: this.actions, guards: this.guards }) //
        .withContext(initialContext as ConnectionContext)
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
    this.started = true

    // kick off the connection by requesting our peer's identity
    this.sendMessage({ type: 'REQUEST_IDENTITY' })

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

  /** Sends an encrypted message to the peer we're connected with */
  public send = (message: Payload) => {
    const { sessionKey } = this.context
    assert(sessionKey)
    const encryptedMessage = symmetric.encrypt(message, sessionKey)
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

  /**
   * Passes an incoming message from the peer on to this protocol machine, guaranteeing that
   * messages will be delivered in the intended order (according to the `index` field on the message)
   */
  public deliver(serializedMessage: string) {
    const message = JSON.parse(serializedMessage) as ConnectionMessage
    assert(
      isNumberedConnectionMessage(message),
      `Can only deliver numbered connection messages; received 
      ${JSON.stringify(message, null, 2)}`
    )

    this.logMessage('in', message, message.index)

    // this.machine.send(message)
    const { queue, nextMessages } = orderedDelivery(this.incomingMessageQueue, message)

    // Update queue
    this.incomingMessageQueue = queue

    // send any messages that are ready to go out
    for (const m of nextMessages) {
      if (this.started && !this.machine.state.done) {
        const peerUserName = this.context.peer?.userName ?? '?'
        this.log(`delivering #${m.index} from ${peerUserName} %o`, m)
        this.machine.send(m)
      } else {
        this.log(`stopped, not delivering #${m.index}`)
      }
    }
  }
  // ACTIONS

  /** These are referred to by name in `connectionMachine` (e.g. `actions: 'sendIdentityClaim'`) */
  private readonly actions: Record<string, StateMachineAction> = {
    sendIdentityClaim: async context => {
      const createIdentityClaim = (context: ConnectionContext) => {
        if (isMember(context)) {
          // I'm already a member
          return {
            deviceId: context.device.deviceId,
          }
        }
        if (isInviteeMember(context)) {
          // I'm a new user and I have an invitation
          const { userName, keys } = context.user
          return {
            proofOfInvitation: this.myProofOfInvitation(context),
            userName,
            userKeys: redactKeys(keys),
            device: redactDevice(context.device),
          }
        }
        if (isInviteeDevice(context)) {
          // I'm a new device for an existing user and I have an invitation
          const { userName, device } = context
          return {
            proofOfInvitation: this.myProofOfInvitation(context),
            userName,
            device: redactDevice(device),
          }
        }
        throw new Error('Invalid context') // that should have been exhaustive
      }

      this.sendMessage({
        type: 'CLAIM_IDENTITY',
        payload: createIdentityClaim(context),
      })
    },

    receiveIdentityClaim: assign((_, event) => {
      const { payload: p } = event as ClaimIdentityMessage
      if ('userName' in p) this.log = this.log.extend(p.userName)

      return {
        theirDeviceId: 'deviceId' in p ? p.deviceId : undefined,
        theyHaveInvitation: 'proofOfInvitation' in p,
        theirProofOfInvitation: 'proofOfInvitation' in p ? p.proofOfInvitation : undefined,
        theirUserKeys: 'userKeys' in p ? p.userKeys : undefined,
        theirDevice: 'device' in p ? p.device : undefined,
        theirUserName: 'userName' in p ? p.userName : undefined,
      }
    }),

    // HANDLING INVITATIONS

    acceptInvitation: assign(context => {
      // Admit them to the team
      const { team, theirProofOfInvitation, theirUserKeys, theirUserName, theirDevice } = context

      assert(team)
      assert(theirProofOfInvitation)

      const admit = () => {
        if (theirUserKeys !== undefined) {
          // New member
          assert(theirUserName)
          team.admitMember(theirProofOfInvitation, theirUserKeys, theirUserName)
          const userId = theirUserKeys.name
          return team.members(userId)
        } else {
          // New device for existing member
          assert(theirDevice)
          team.admitDevice(theirProofOfInvitation, theirDevice)
          const { deviceId } = theirDevice
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
      const deviceId = context.theirDeviceId
      if (deviceId === undefined) return {} // If they haven't sent a deviceId, they're not on the team yet
      if (context.team === undefined) return {} // If we're not on the team yet, we don't have a way of knowing if the peer is

      try {
        const device = context.team.device(deviceId, { includeRemoved: true })
        const user = context.team.memberByDeviceId(deviceId, { includeRemoved: true })

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

    challengeIdentity: assign({
      challenge: context => {
        const { theirDeviceId } = context
        assert(theirDeviceId)
        const challenge = identity.challenge({ type: DEVICE, name: theirDeviceId })
        this.sendMessage({
          type: 'CHALLENGE_IDENTITY',
          payload: { challenge },
        })
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

    sendSyncMessage: assign({
      syncState: context => {
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

        return syncState
      },
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

    generateSeed: assign({ seed: _ => randomKey() }),

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
      return { theirEncryptedSeed: payload.encryptedSeed }
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
    failDeviceWasRemoved: this.fail('DEVICE_REMOVED'),
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

    iHaveInvitation: context => isInvitee(context),

    theyHaveInvitation: context => context.theyHaveInvitation!,

    bothHaveInvitation: (...args) =>
      this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args),

    invitationProofIsValid: context => {
      const { team, theirProofOfInvitation } = context
      assert(team)
      assert(theirProofOfInvitation)
      const validation = team.validateInvitation(theirProofOfInvitation)
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

    identityProofIsValid(context, event) {
      const { team } = context
      assert(team)
      const { payload } = event as ProveIdentityMessage
      const { challenge, proof } = payload
      return team.verifyIdentityProof(challenge, proof)
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
    const peerUserName = this.context.peer?.userName ?? '?'
    this.log(`${arrow}${peerUserName} #${index} ${messageSummary(message)}`)
  }

  private myProofOfInvitation(context: ConnectionContext) {
    assert(context.invitationSeed)
    return invitations.generateProof(context.invitationSeed)
  }
}

const isMember = (context: ConnectionContext) => context.team !== undefined

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
  sendMessage: SendFunction

  /** The initial context. */
  context: InitialContext
}

/**
 * A server is conceptually kind of a user and kind of a device. This little hack lets us avoid
 * creating special logic for servers all over the place.
 */
const extendServerContext = (context: ServerInitialContext) => {
  const { keys, host } = context.server
  return {
    ...context,
    user: { userId: host, userName: host, keys },
    device: { userId: host, deviceId: host, deviceName: host, keys },
  }
}
