/* eslint-disable object-shorthand */

import { EventEmitter } from '@herbcaudill/eventemitter42'
import {
  generateMessage,
  headsAreEqual,
  initSyncState,
  receiveMessage,
  redactKeys,
  type DecryptFnParams,
} from '@localfirst/crdx'
import { asymmetric, randomKeyBytes, symmetric, type Hash, type Payload } from '@localfirst/crypto'
import { assert, debug } from '@localfirst/shared'
import { deriveSharedKey } from 'connection/deriveSharedKey.js'
import {
  createErrorMessage,
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
import * as invitations from 'invitation/index.js'
import { pack, unpack } from 'msgpackr'
import { getTeamState } from 'team/getTeamState.js'
import { Team, decryptTeamGraph, type TeamAction, type TeamContext } from 'team/index.js'
import * as select from 'team/selectors/index.js'
import { arraysAreEqual } from 'util/arraysAreEqual.js'
import { KeyType } from 'util/index.js'
import { syncMessageSummary } from 'util/testing/messageSummary.js'
import { assign, createActor, setup } from 'xstate'
import { MessageQueue, type NumberedMessage } from './MessageQueue.js'
import type {
  ConnectionContext,
  ConnectionEvents,
  Context,
  IdentityClaim,
  ServerContext,
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

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol.
 */
export class Connection extends EventEmitter<ConnectionEvents> {
  /** The interpreted state machine. Its XState configuration is in `machine.ts`. */
  private readonly machine
  private started = false
  private readonly messageQueue: MessageQueue<ConnectionMessage>
  private log = debug.extend('auth:connection')

  constructor({ sendMessage, context }: ConnectionParams) {
    super()

    // To send messages to our peer, we give them to the ordered network,
    // which will deliver them using the
    this.messageQueue = new MessageQueue<ConnectionMessage>({
      sendMessage: message => {
        this.logMessage('out', message)
        const serialized = pack(message)
        sendMessage(serialized)
      },
    })
      .on('message', message => {
        this.logMessage('in', message)
        // Handle requests from the peer to resend messages that they missed
        if (message.type === 'REQUEST_RESEND') {
          const { index } = message.payload
          this.messageQueue.resend(index)
          return
        }

        // Pass other messages from peer to the state machine
        this.machine.send(message)
      })
      .on('request', index => {
        // Send out requests to resend messages that we missed
        this.messageQueue.send({ type: 'REQUEST_RESEND', payload: { index } })
      })

    this.log = this.log.extend(getUserName(context))

    const initialContext: Context = isServerContext(context)
      ? extendServerContext(context)
      : context

    const machine = setup({
      types: {
        context: {} as ConnectionContext,
        events: {} as ConnectionMessage,
      },
      actions: {
        sendIdentityClaim: assign(({ context }) => {
          const createIdentityClaim = (context: ConnectionContext): IdentityClaim => {
            if (isMemberContext(context)) {
              // I'm already a member
              return {
                deviceId: context.device.deviceId,
              }
            }
            if (isInviteeMemberContext(context)) {
              // I'm a new user and I have an invitation
              assert(context.invitationSeed)
              const { userName, keys } = context.user
              return {
                proofOfInvitation: invitations.generateProof(context.invitationSeed),
                userName,
                userKeys: redactKeys(keys),
                device: redactDevice(context.device),
              }
            }
            if (isInviteeDeviceContext(context)) {
              // I'm a new device for an existing user and I have an invitation
              assert(context.invitationSeed)
              const { userName, device } = context
              return {
                proofOfInvitation: invitations.generateProof(context.invitationSeed),
                userName,
                device: redactDevice(device),
              }
            }
            // ignore coverage - that should have been exhaustive
            throw new Error('Invalid context')
          }

          const ourIdentityClaim = createIdentityClaim(context)
          this.messageQueue.send({
            type: 'CLAIM_IDENTITY',
            payload: ourIdentityClaim,
          })

          return { ourIdentityClaim }
        }),

        receiveIdentityClaim: assign(({ event }) => {
          const { payload } = event as ClaimIdentityMessage
          if ('userName' in payload) this.log = this.log.extend(payload.userName)

          return {
            theirIdentityClaim: payload,
            theirDevice: 'device' in payload ? payload.device : undefined,
          }
        }),

        // HANDLING INVITATIONS

        acceptInvitation: assign(({ context }) => {
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
          this.messageQueue.send({
            type: 'ACCEPT_INVITATION',
            payload: {
              serializedGraph: team.save(),
              teamKeyring: team.teamKeyring(),
            },
          })

          return { peer }
        }),

        joinTeam: assign(({ context, event }) => {
          const { payload } = event as AcceptInvitationMessage
          const { serializedGraph, teamKeyring } = payload
          const { device, invitationSeed } = context

          // We've been given the serialized and encrypted graph, and the team keyring. We can decrypt
          // the graph and reconstruct the team.

          const getDeviceUser = () => {
            // If we're joining as a new device for an existing member, we don't know our user id or
            // user keys yet, so we need to get those from the graph.
            assert(context.invitationSeed)
            const { id: invitationId } = invitations.generateProof(context.invitationSeed)

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

          this.emit('joined', { team, user })

          return { user, team }
        }),

        // AUTHENTICATING

        recordIdentity: assign(({ context }) => {
          const { team, theirIdentityClaim } = context
          assert(theirIdentityClaim)
          assert(team) // If we're not on the team yet, we don't have a way of knowing if the peer is
          assert(isMemberClaim(theirIdentityClaim)) // This is only for members authenticating with deviceId

          const { deviceId } = theirIdentityClaim
          const device = team.device(deviceId, { includeRemoved: true })
          const user = team.memberByDeviceId(deviceId, { includeRemoved: true })

          this.log = this.log.extend(user.userName)

          return {
            theirDevice: device,
            peer: user,
          }
        }),

        challengeIdentity: assign(({ context }) => {
          const { theirIdentityClaim } = context
          assert(theirIdentityClaim)
          assert(isMemberClaim(theirIdentityClaim))
          const { deviceId } = theirIdentityClaim
          const challenge = identity.challenge({ type: DEVICE, name: deviceId })
          this.messageQueue.send({
            type: 'CHALLENGE_IDENTITY',
            payload: { challenge },
          })
          return { challenge }
        }),

        proveIdentity: ({ context, event }) => {
          assert(context.user)
          const { challenge } = (event as ChallengeIdentityMessage).payload
          const proof = identity.prove(challenge, context.device.keys)
          this.messageQueue.send({
            type: 'PROVE_IDENTITY',
            payload: { challenge, proof },
          })
        },

        acceptIdentity: () => {
          this.messageQueue.send({ type: 'ACCEPT_IDENTITY' })
        },

        // UPDATING

        listenForTeamUpdates: ({ context }) => {
          assert(context.team)
          context.team.on('updated', ({ head }: { head: Hash[] }) => {
            if (this.machine.getSnapshot().status !== 'done') {
              this.machine.send({ type: 'LOCAL_UPDATE', payload: { head } }) // Send update event to local machine
            }
            this.emit('updated')
          })
        },

        sendSyncMessage: assign(({ context }) => {
          assert(context.team)
          const previousSyncState = context.syncState ?? initSyncState()

          const [syncState, syncMessage] = generateMessage(context.team.graph, previousSyncState)

          // Undefined message means we're already synced
          if (syncMessage) {
            this.log('sending sync message', syncMessageSummary(syncMessage))
            this.messageQueue.send({ type: 'SYNC', payload: syncMessage })
          } else {
            this.log('no sync message to send')
          }

          return { syncState }
        }),

        receiveSyncMessage: assign(({ context, event }) => {
          const { payload } = event as SyncMessage
          const { team, device } = context
          assert(team)

          // ignore coverage
          const previousSyncState = context.syncState ?? initSyncState()
          const teamKeys = team.teamKeys()
          const deviceKeys = device.keys

          // ! handle errors here

          const decrypt = ({ encryptedGraph, keys }: DecryptFnParams<TeamAction, TeamContext>) =>
            decryptTeamGraph({ encryptedGraph, teamKeys: keys, deviceKeys })

          const [newChain, syncState] = receiveMessage(
            team.graph,
            previousSyncState,
            payload,
            teamKeys,
            decrypt
          )

          if (headsAreEqual(newChain.head, team.graph.head)) {
            // nothing changed
            return { syncState }
          } else {
            this.emit('updated')
            const newTeam = team.merge(newChain)
            return { team: newTeam, syncState }
          }
        }),

        // NEGOTIATING

        generateSeed: assign(() => {
          return { seed: randomKeyBytes() }
        }),

        sendSeed: ({ context }) => {
          const { user, peer, seed } = context

          const encryptedSeed = asymmetric.encryptBytes({
            secret: seed!,
            recipientPublicKey: peer!.keys.encryption,
            senderSecretKey: user!.keys.encryption.secretKey,
          })

          this.messageQueue.send({
            type: 'SEED',
            payload: { encryptedSeed },
          })
        },

        receiveSeed: assign(({ event }) => {
          const { payload } = event as SeedMessage
          return { theirEncryptedSeed: payload.encryptedSeed }
        }),

        deriveSharedKey: assign({
          sessionKey: ({ context }) => {
            const { user, seed, theirEncryptedSeed, peer } = context

            // We saved our seed in context
            assert(seed)

            // Their encrypted seed is stored in context
            assert(theirEncryptedSeed)
            // Decrypt it:
            const theirSeed = asymmetric.decryptBytes({
              cipher: theirEncryptedSeed,
              senderPublicKey: peer!.keys.encryption,
              recipientSecretKey: user!.keys.encryption.secretKey,
            })

            // With the two keys, we derive a shared key
            return deriveSharedKey(seed, theirSeed)
          },
        }),

        // COMMUNICATING

        receiveEncryptedMessage: ({ context, event }) => {
          const { sessionKey } = context
          assert(sessionKey)
          const { payload: encryptedMessage } = event as EncryptedMessage

          // ! TODO: we need to handle errors here - for example if we haven't converged on the same
          // ! session key, we'll get `Error: wrong secret key for the given ciphertext`; currently that
          // ! will crash the app (or the sync server!)

          const decryptedMessage = symmetric.decryptBytes(encryptedMessage, sessionKey)

          this.emit('message', decryptedMessage)
        },

        // FAILURE

        receiveError: assign(({ event }) => {
          const { payload: error } = event as ErrorMessage
          this.log('receiveError %o', error)

          // Bubble the error up
          this.emit('remoteError', error)

          // Store the error in context
          return { error }
        }),

        sendError: assign(({ event }) => {
          const { payload: error } = event as LocalErrorMessage
          this.log('sendError %o', error)

          // Send error to peer
          const remoteMessage = createErrorMessage(error.type, error.details, 'REMOTE')
          this.messageQueue.send(remoteMessage)

          // Bubble the error up
          this.emit('localError', error)

          // Store the error in context
          return { error }
        }),

        fail: assign(({ context }, params: { error: ConnectionErrorType }) => {
          const { error } = params
          const details = context.error as any

          const detailedMessage =
            details && 'message' in details ? (details.message as string) : undefined

          this.log('error: %s %o', error, details)

          // Force error state locally
          const localMessage = createErrorMessage(error, detailedMessage, 'LOCAL')
          this.machine.send(localMessage)

          return { error: localMessage.payload }
        }),

        // EVENTS FOR EXTERNAL LISTENERS

        onConnected: () => this.emit('connected'),
        onDisconnected: ({ event }) => this.emit('disconnected', event),
      },
      guards: {
        // INVITATIONS

        weHaveInvitation: ({ context }) => isInviteeContext(context),

        theyHaveInvitation: ({ context }) => isInviteeClaim(context.theirIdentityClaim!),

        bothHaveInvitation: ({ context }) =>
          isInviteeContext(context) && isInviteeClaim(context.theirIdentityClaim!),

        invitationProofIsValid: ({ context }) => {
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

        joinedTheRightTeam: ({ context, event }) => {
          // Make sure my invitation exists on the signature chain of the team I'm about to join.
          // This check prevents an attack in which a fake team pretends to accept my invitation.
          assert(context.invitationSeed)
          const { payload } = event as AcceptInvitationMessage
          const { serializedGraph, teamKeyring } = payload
          const state = getTeamState(serializedGraph, teamKeyring)
          const { id } = invitations.generateProof(context.invitationSeed)
          return select.hasInvitation(state, id)
        },

        // IDENTITY

        bothSentIdentityClaim: ({ context }) => {
          return context.ourIdentityClaim !== undefined && context.theirIdentityClaim !== undefined
        },

        deviceUnknown: ({ context }) => {
          const { team, theirIdentityClaim } = context
          assert(theirIdentityClaim)
          assert(team) // If we're not on the team yet, we don't have a way of knowing if the peer is
          assert(isMemberClaim(theirIdentityClaim)) // This is only for existing members (authenticating with deviceId rather than invitation)

          const { deviceId } = theirIdentityClaim

          return !team.hasDevice(deviceId, { includeRemoved: true })
        },

        identityProofIsValid({ context, event }) {
          const { team } = context
          assert(team)
          const { payload } = event as ProveIdentityMessage
          const { challenge, proof } = payload
          return team.verifyIdentityProof(challenge, proof)
        },

        memberWasRemoved({ context }) {
          const { team, peer } = context
          assert(team)
          assert(peer)
          return team.memberWasRemoved(peer.userId)
        },

        deviceWasRemoved({ context }) {
          const { team, theirDevice } = context
          assert(team)
          assert(theirDevice)
          const deviceWasRemoved = team.deviceWasRemoved(theirDevice.deviceId)
          return deviceWasRemoved
        },

        serverWasRemoved({ context }) {
          const { team, peer } = context
          assert(team)
          assert(peer)
          const serverWasRemoved = team.serverWasRemoved(peer.userId)
          return serverWasRemoved
        },

        // SYNCHRONIZATION

        headsAreEqual({ context }) {
          const { team, syncState } = context
          assert(team)
          const ourHead = team.graph.head
          const lastCommonHead = syncState?.lastCommonHead
          return arraysAreEqual(ourHead, lastCommonHead)
        },
      },
    }).createMachine({
      context: initialContext as ConnectionContext,
      id: 'connection',
      initial: 'awaitingIdentityClaim',
      on: {
        REQUEST_IDENTITY: { actions: 'sendIdentityClaim', target: '#awaitingIdentityClaim' },
        CLAIM_IDENTITY: { actions: ['receiveIdentityClaim'], target: '#awaitingIdentityClaim' },
        ERROR: { actions: 'receiveError', target: '#disconnected' }, // Remote error (sent by peer)
        LOCAL_ERROR: { actions: 'sendError', target: '#disconnected' }, // Local error (detected by us, sent to peer)
      },
      states: {
        awaitingIdentityClaim: {
          id: 'awaitingIdentityClaim',
          always: { guard: 'bothSentIdentityClaim', target: 'authenticating' },
        },
        authenticating: {
          id: 'authenticating',
          initial: 'checkingInvitations',
          states: {
            checkingInvitations: {
              initial: 'checkingForInvitations',
              states: {
                checkingForInvitations: {
                  always: [
                    // We can't both present invitations - someone has to be a member
                    { guard: 'bothHaveInvitation', ...fail(NEITHER_IS_MEMBER) },
                    // If I have an invitation, wait for acceptance
                    { guard: 'weHaveInvitation', target: 'awaitingInvitationAcceptance' },
                    // If they have an invitation, validate it
                    { guard: 'theyHaveInvitation', target: 'validatingInvitation' },
                    // Otherwise, we can proceed directly to authentication
                    { target: '#checkingIdentity' },
                  ],
                },
                awaitingInvitationAcceptance: {
                  // Wait for them to validate the invitation we've shown
                  on: {
                    ACCEPT_INVITATION: [
                      // Make sure the team I'm joining is actually the one that invited me
                      {
                        guard: 'joinedTheRightTeam',
                        actions: 'joinTeam',
                        target: '#checkingIdentity',
                      },
                      // If it's not, disconnect with error
                      fail(JOINED_WRONG_TEAM),
                    ],
                  },
                  ...timeout,
                },
                validatingInvitation: {
                  always: [
                    // If the proof succeeds, add them to the team and send an acceptance message,
                    // then proceed to the standard identity claim & challenge process
                    {
                      guard: 'invitationProofIsValid',
                      actions: 'acceptInvitation',
                      target: '#checkingIdentity',
                    },
                    // If the proof fails, disconnect with error
                    fail(INVITATION_PROOF_INVALID),
                  ],
                },
              },
            },
            checkingIdentity: {
              id: 'checkingIdentity',
              // Peers mutually authenticate to each other, so we have to complete two parallel processes:
              // 1. prove our identity
              // 2. verify their identity
              type: PARALLEL,
              states: {
                // 1. prove our identity
                provingMyIdentity: {
                  initial: 'awaitingIdentityChallenge',
                  states: {
                    awaitingIdentityChallenge: {
                      // If we just presented an invitation, they already know who we are
                      always: { guard: 'weHaveInvitation', target: 'doneProvingMyIdentity' },
                      on: {
                        // When we receive a challenge, respond with proof
                        CHALLENGE_IDENTITY: {
                          actions: 'proveIdentity',
                          target: 'awaitingIdentityAcceptance',
                        },
                      },
                      ...timeout,
                    },
                    // Wait for a message confirming that they've validated our proof of identity
                    awaitingIdentityAcceptance: {
                      on: { ACCEPT_IDENTITY: { target: 'doneProvingMyIdentity' } },
                      ...timeout,
                    },
                    doneProvingMyIdentity: { type: FINAL },
                  },
                },
                // 2. verify their identity
                verifyingTheirIdentity: {
                  initial: 'challengingIdentity',
                  states: {
                    challengingIdentity: {
                      always: [
                        // If they just presented an invitation, they've already proven their identity - we can move on
                        { guard: 'theyHaveInvitation', target: 'doneVerifyingTheirIdentity' },
                        // We received their identity claim in their CLAIM_IDENTITY message. Do we have a device on the team matching their identity claim?
                        { guard: 'deviceUnknown', ...fail(DEVICE_UNKNOWN) },
                        // Send a challenge.
                        {
                          actions: ['recordIdentity', 'challengeIdentity'],
                          target: 'awaitingIdentityProof',
                        },
                      ],
                    },
                    // Then wait for them to respond to the challenge with proof
                    awaitingIdentityProof: {
                      on: {
                        PROVE_IDENTITY: [
                          // If the proof succeeds, we're done on our side
                          {
                            guard: 'identityProofIsValid',
                            actions: 'acceptIdentity',
                            target: 'doneVerifyingTheirIdentity',
                          },
                          // If the proof fails, disconnect with error
                          fail(INVITATION_PROOF_INVALID),
                        ],
                      },
                      ...timeout,
                    },
                    doneVerifyingTheirIdentity: { type: FINAL },
                  },
                },
              },
              // Once BOTH processes complete, we continue
              onDone: { target: 'doneAuthenticating' },
            },
            doneAuthenticating: { type: FINAL },
          },
          onDone: { actions: ['listenForTeamUpdates'], target: '#negotiating' },
        },
        negotiating: {
          id: 'negotiating',
          entry: 'generateSeed',
          initial: 'awaitingSeed',
          states: {
            awaitingSeed: {
              entry: 'sendSeed',
              on: { SEED: { actions: 'receiveSeed', target: 'doneNegotiating' } },
              ...timeout,
            },
            doneNegotiating: { entry: 'deriveSharedKey', type: FINAL },
          },
          onDone: { actions: 'sendSyncMessage', target: '#synchronizing' },
        },
        synchronizing: {
          id: 'synchronizing',
          always: [{ guard: 'headsAreEqual', actions: 'onConnected', target: '#connected' }],
          on: {
            SYNC: { actions: ['receiveSyncMessage', 'sendSyncMessage'], target: '#synchronizing' },
          },
        },
        connected: {
          id: 'connected',
          always: [
            // If the peer is no longer on the team (or no longer has device), disconnect
            { guard: 'memberWasRemoved', ...fail(MEMBER_REMOVED) },
            { guard: 'deviceWasRemoved', ...fail(DEVICE_REMOVED) },
            { guard: 'serverWasRemoved', ...fail(SERVER_REMOVED) },
          ],
          on: {
            // If something changes locally, send them a sync message
            LOCAL_UPDATE: { actions: ['sendSyncMessage'], target: '#connected' },
            // If they send a sync message, process it
            SYNC: {
              actions: ['receiveSyncMessage', 'sendSyncMessage'],
              target: '#connected',
            },
            // Deliver any encrypted messages
            ENCRYPTED_MESSAGE: {
              actions: 'receiveEncryptedMessage',
              target: '#connected',
            },
            DISCONNECT: '#disconnected',
          },
        },
        disconnected: {
          id: 'disconnected',
          entry: 'onDisconnected',
        },
      },
    })
    // Instantiate the state machine
    this.machine = createActor(machine)

    // emit and log all transitions
    this.machine.subscribe(state => {
      const summary = stateSummary(state.value as string)
      this.emit('change', summary)
      this.log(`⏩ ${summary} `)
    })

    // add automatic logging to all events
    this.emit = (event, ...args) => {
      this.log(`emit ${event} %o`, ...args)
      return super.emit(event, ...args)
    }
  }

  // PUBLIC API

  /** Starts the protocol machine. Returns this Protocol object. */
  public start = (storedMessages: Uint8Array[] = []) => {
    this.log('starting')
    this.machine.start()
    this.messageQueue.start()
    this.started = true

    // kick off the connection by requesting our peer's identity
    this.messageQueue.send({ type: 'REQUEST_IDENTITY' })

    for (const m of storedMessages) this.deliver(m)

    return this
  }

  /** Sends a disconnect message to the peer. */
  public stop = () => {
    if (this.started && this.machine.getSnapshot().status !== 'done') {
      const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
      this.machine.send(disconnectMessage) // Send disconnect event to local machine
      try {
        this.messageQueue.send(disconnectMessage) // Send disconnect message to peer
      } catch {
        // our connection to the peer may already be gone by this point, don't throw
      }
    }

    this.removeAllListeners()
    this.messageQueue.stop()
    this.log('connection stopped')
    return this
  }

  /** Returns the current state of the protocol machine. */
  public get state() {
    assert(this.started)
    return this.machine.getSnapshot().value
  }

  public get context(): ConnectionContext {
    assert(this.started)
    return this.machine.getSnapshot().context
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

  /**
   * Adds incoming messages from the peer to the MessageQueue's incoming message queue, which will
   * pass them to the state machine in order.
   */
  public deliver(serializedMessage: Uint8Array) {
    const message = unpack(serializedMessage) as NumberedMessage<ConnectionMessage>
    this.messageQueue.receive(message)
  }

  /** Sends an encrypted message to our peer. */
  public send = (message: Payload) => {
    assert(this.sessionKey)
    const encryptedMessage = symmetric.encryptBytes(message, this.sessionKey)
    this.messageQueue.send({ type: 'ENCRYPTED_MESSAGE', payload: encryptedMessage })
  }

  // PRIVATE

  private logMessage(direction: 'in' | 'out', message: NumberedMessage<ConnectionMessage>) {
    const arrow = direction === 'in' ? '<-' : '->'
    const peerUserName = this.started ? this.context.peer?.userName ?? '?' : '?'
    this.log(`${arrow}${peerUserName} #${message.index} ${messageSummary(message)}`)
  }
}

// HELPERS

// FOR DEBUGGING

const messageSummary = (message: ConnectionMessage) =>
  message.type === 'SYNC'
    ? `SYNC ${syncMessageSummary(message.payload)}`
    : // @ts-expect-error utility function don't worry about it
      `${message.type} ${message.payload?.head?.slice(0, 5) || message.payload?.message || ''}`

const isString = (state: any): state is string => typeof state === 'string'

// ignore coverage
const stateSummary = (state: any): string =>
  isString(state)
    ? state
    : Object.keys(state)
        .map(key => `${key}:${stateSummary(state[key])}`)
        .filter(s => s.length)
        .join(',')

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

const getUserName = (context: Context) => {
  if ('server' in context) return context.server.host
  if ('userName' in context) return context.userName
  if ('user' in context) return context.user.userName
  return ''
}

// CONSTANTS

// const IDENTITY_PROOF_INVALID = 'IDENTITY_PROOF_INVALID' as ConnectionErrorType
const DEVICE_UNKNOWN = 'DEVICE_UNKNOWN' as ConnectionErrorType
const NEITHER_IS_MEMBER = 'NEITHER_IS_MEMBER' as ConnectionErrorType
const INVITATION_PROOF_INVALID = 'INVITATION_PROOF_INVALID' as ConnectionErrorType
const JOINED_WRONG_TEAM = 'JOINED_WRONG_TEAM' as ConnectionErrorType
const MEMBER_REMOVED = 'MEMBER_REMOVED' as ConnectionErrorType
const DEVICE_REMOVED = 'DEVICE_REMOVED' as ConnectionErrorType
const SERVER_REMOVED = 'SERVER_REMOVED' as ConnectionErrorType
const TIMEOUT = 'TIMEOUT' as ConnectionErrorType

const PARALLEL = 'parallel' as const
const FINAL = 'final' as const

// Shared timeout settings
const TIMEOUT_DELAY = 7000

const { DEVICE } = KeyType

// TYPES

export type ConnectionParams = {
  /** A function to send messages to our peer. This how you hook this up to your network stack. */
  sendMessage: (message: Uint8Array) => void

  /** The initial context. */
  context: Context
}

const fail = (error: ConnectionErrorType) =>
  ({ actions: { type: 'fail', params: { error } }, target: '#disconnected' }) as const

const timeout = { after: { [TIMEOUT_DELAY]: fail(TIMEOUT) } } as const
