/* eslint-disable object-shorthand */

import { EventEmitter } from '@herbcaudill/eventemitter42'
import type {
  DecryptFnParams,
  Keyring,
  KeysetWithSecrets,
  User,
  UserWithSecrets,
} from '@localfirst/crdx'
import {
  generateMessage,
  headsAreEqual,
  initSyncState,
  receiveMessage,
  redactKeys,
} from '@localfirst/crdx'
import { asymmetric, randomKeyBytes, symmetric, type Hash, type Payload } from '@localfirst/crypto'
import { assert, debug } from '@localfirst/shared'
import { deriveSharedKey } from 'connection/deriveSharedKey.js'
import { createErrorMessage, type ConnectionErrorType } from 'connection/errors.js'
import { getDeviceUserFromGraph } from 'connection/getDeviceUserFromGraph.js'
import * as identity from 'connection/identity.js'
import type { ConnectionMessage, DisconnectMessage } from 'connection/message.js'
import { redactDevice, type DeviceWithSecrets } from 'device/index.js'
import * as invitations from 'invitation/index.js'
import { pack, unpack } from 'msgpackr'
import { getTeamState } from 'team/getTeamState.js'
import { Team, decryptTeamGraph, type TeamAction, type TeamContext } from 'team/index.js'
import * as select from 'team/selectors/index.js'
import { arraysAreEqual } from 'util/arraysAreEqual.js'
import { KeyType } from 'util/index.js'
import { syncMessageSummary } from 'util/testing/messageSummary.js'
import { and, assertEvent, assign, createActor, setup } from 'xstate'
import { MessageQueue, type NumberedMessage } from './MessageQueue.js'
import type {
  Challenge,
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
        this.#logMessage('out', message)
        const serialized = pack(message)
        sendMessage(serialized)
      },
    })
      .on('message', message => {
        this.#logMessage('in', message)
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
          this.messageQueue.send({ type: 'CLAIM_IDENTITY', payload: ourIdentityClaim })

          return { ourIdentityClaim }
        }),

        receiveIdentityClaim: assign((_, { identityClaim }: { identityClaim: IdentityClaim }) => {
          if ('userName' in identityClaim) {
            this.log = this.log.extend(identityClaim.userName)
          }
          const theirDevice = 'device' in identityClaim ? identityClaim.device : undefined
          return { theirIdentityClaim: identityClaim, theirDevice }
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

        joinTeam: assign(
          (
            _,
            params: {
              serializedGraph: Uint8Array
              teamKeyring: Keyring
              device: DeviceWithSecrets
              invitationSeed: string
              user?: UserWithSecrets
            }
          ) => {
            const {
              serializedGraph,
              teamKeyring,
              device,
              invitationSeed,
              // If we're joining as a new device for an existing member, we don't have a user
              // object yet, so we need to get those from the graph. We use the invitation seed to
              // generate the starter keys for the new device. We can use these to unlock a lockbox
              // on the team graph that contains our user keys.
              user = getDeviceUserFromGraph({ serializedGraph, teamKeyring, invitationSeed }),
            } = params
            // Our user has been added to the team graph by our peer. We've been given the
            // serialized and encrypted graph, and the team keyring. We can now decrypt the graph and
            // reconstruct the team in order to join it.
            const team = new Team({
              source: serializedGraph,
              context: { user, device },
              teamKeyring,
            })
            // We join the team, which adds our device to the team graph.
            team.join(teamKeyring)
            this.emit('joined', { team, user })
            return { user, team }
          }
        ),

        // AUTHENTICATING

        challengeIdentity: assign(({ context }) => {
          const { team, theirIdentityClaim } = context
          assert(team) // If we're not on the team yet, we don't have a way of knowing if the peer is
          assert(isMemberClaim(theirIdentityClaim!)) // This is only for members authenticating with deviceId

          // look up their device and user info on the team
          const { deviceId } = theirIdentityClaim
          const theirDevice = team.device(deviceId, { includeRemoved: true })
          const peer = team.memberByDeviceId(deviceId, { includeRemoved: true })

          // we now have a user name so add that to the debug logger
          this.log = this.log.extend(peer.userName)

          // send them an identity challenge
          const challenge = identity.challenge({ type: DEVICE, name: deviceId })
          this.messageQueue.send({
            type: 'CHALLENGE_IDENTITY',
            payload: { challenge },
          })

          // record their identity info and the challenge in context
          return { theirDevice, peer, challenge }
        }),

        proveIdentity: (
          _,
          { challenge, keys }: { challenge: Challenge; keys: KeysetWithSecrets }
        ) => {
          this.messageQueue.send({
            type: 'PROVE_IDENTITY',
            payload: { challenge, proof: identity.prove(challenge, keys) },
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
          assertEvent(event, 'SYNC')
          const syncMessage = event.payload
          const { syncState: prevSyncState = initSyncState(), team, device } = context

          assert(team)
          const teamKeys = team.teamKeys()
          const deviceKeys = device.keys

          // handle errors here
          const decrypt = ({ encryptedGraph, keys }: DecryptFnParams<TeamAction, TeamContext>) =>
            decryptTeamGraph({ encryptedGraph, teamKeys: keys, deviceKeys })

          const [newChain, syncState] = receiveMessage(
            team.graph,
            prevSyncState,
            syncMessage,
            teamKeys,
            decrypt
          )

          if (headsAreEqual(newChain.head, team.graph.head)) {
            // nothing changed
            return { syncState }
          } else {
            this.emit('updated')
            return { team: team.merge(newChain), syncState }
          }
        }),

        // NEGOTIATING

        sendSeed: assign(({ context }) => {
          const { user, peer, seed = randomKeyBytes() } = context
          const encryptedSeed = asymmetric.encryptBytes({
            secret: seed,
            recipientPublicKey: peer!.keys.encryption,
            senderSecretKey: user!.keys.encryption.secretKey,
          })

          this.messageQueue.send({
            type: 'SEED',
            payload: { encryptedSeed },
          })
          return { seed }
        }),

        deriveSharedKey: assign(
          (
            _,
            params: {
              encryptedSeed: Uint8Array
              user: UserWithSecrets
              seed: Uint8Array
              peer: User
            }
          ) => {
            const { encryptedSeed, user, seed, peer } = params
            // decrypt the seed they sent
            const theirSeed = asymmetric.decryptBytes({
              cipher: encryptedSeed,
              senderPublicKey: peer.keys.encryption,
              recipientSecretKey: user.keys.encryption.secretKey,
            })

            // With the two keys, we derive a shared key
            return {
              sessionKey: deriveSharedKey(seed, theirSeed),
            }
          }
        ),

        // COMMUNICATING

        receiveEncryptedMessage: (
          _,
          { sessionKey, encryptedMessage }: { sessionKey: Uint8Array; encryptedMessage: Uint8Array }
        ) => {
          // !
          // TODO: we need to handle errors here - for example if we haven't converged on the same
          // session key, we'll get `Error: wrong secret key for the given ciphertext`; currently that
          // will crash the app (or the sync server!)
          const decryptedMessage = symmetric.decryptBytes(encryptedMessage, sessionKey)
          this.emit('message', decryptedMessage)
        },

        // FAILURE

        fail: assign((_, { error }: { error: ConnectionErrorType }) => {
          this.log('error: %s %o', error)

          // Force error state locally
          const localMessage = createErrorMessage(error, 'LOCAL')
          this.machine.send(localMessage)

          return { error: localMessage.payload }
        }),

        // EVENTS FOR EXTERNAL LISTENERS

        onConnected: () => this.emit('connected'),
        onDisconnected: ({ event }) => this.emit('disconnected', event),
      },
      guards: {
        weHaveInvitation: ({ context }) => isInviteeContext(context),
        theyHaveInvitation: ({ context }) => isInviteeClaim(context.theirIdentityClaim!),
        neitherIsMember: and(['weHaveInvitation', 'theyHaveInvitation']),

        invitationProofIsValid: ({ context }) => {
          const { team, theirIdentityClaim } = context
          assert(isInviteeClaim(theirIdentityClaim!))
          return team!.validateInvitation(theirIdentityClaim.proofOfInvitation).isValid
        },

        joinedTheRightTeam: (
          _,
          params: { invitationSeed: string; serializedGraph: Uint8Array; teamKeyring: Keyring }
        ) => {
          const { invitationSeed, serializedGraph, teamKeyring } = params
          // Make sure my invitation exists on the signature chain of the team I'm about to join.
          // This check prevents an attack in which a fake team pretends to accept my invitation.
          const state = getTeamState(serializedGraph, teamKeyring)
          const { id } = invitations.generateProof(invitationSeed)
          return select.hasInvitation(state, id)
        },

        bothSentIdentityClaim: ({ context }) =>
          context.ourIdentityClaim !== undefined && context.theirIdentityClaim !== undefined,

        deviceUnknown: ({ context }) => {
          const { theirIdentityClaim } = context
          assert(isMemberClaim(theirIdentityClaim!)) // This is only for existing members (authenticating with deviceId rather than invitation)
          return !context.team!.hasDevice(theirIdentityClaim.deviceId, { includeRemoved: true })
        },

        memberWasRemoved: ({ context }) => context.team!.memberWasRemoved(context.peer!.userId),

        deviceWasRemoved: ({ context }) =>
          context.team!.deviceWasRemoved(context.theirDevice!.deviceId),

        serverWasRemoved: ({ context }) => context.team!.serverWasRemoved(context.peer!.userId),

        headsAreEqual: ({ context }) =>
          arraysAreEqual(
            context.team!.graph.head, // our head
            context.syncState?.lastCommonHead // last head we had in common with peer
          ),
      },
    }).createMachine({
      context: initialContext as ConnectionContext,
      id: 'connection',
      initial: 'awaitingIdentityClaim',
      on: {
        REQUEST_IDENTITY: { actions: 'sendIdentityClaim', target: '#awaitingIdentityClaim' },

        // Remote error (sent by peer)
        ERROR: {
          actions: assign(({ event }) => {
            const { payload: error } = event
            this.log('receiveError %o', error)
            this.emit('remoteError', error)
            return { error }
          }),
          target: '#disconnected',
        },
        // Local error (detected by us, sent to peer)
        LOCAL_ERROR: {
          actions: assign(({ event }) => {
            const { payload: error } = event
            this.log('sendError %o', error)
            this.messageQueue.send(createErrorMessage(error.type, 'REMOTE'))
            this.emit('localError', error)
            return { error }
          }),
          target: '#disconnected',
        },
      },
      states: {
        awaitingIdentityClaim: {
          id: 'awaitingIdentityClaim',
          always: { guard: 'bothSentIdentityClaim', target: 'authenticating' },
          on: {
            CLAIM_IDENTITY: {
              actions: {
                type: 'receiveIdentityClaim',
                params: ({ event }) => ({
                  identityClaim: event.payload,
                }),
              },
              target: '#awaitingIdentityClaim',
            },
          },
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
                    {
                      guard: and(['weHaveInvitation', 'theyHaveInvitation']),
                      ...fail(NEITHER_IS_MEMBER),
                    },
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
                        guard: {
                          type: 'joinedTheRightTeam',
                          params: ({ context, event }) => ({
                            invitationSeed: context.invitationSeed!,
                            ...event.payload,
                          }),
                        },
                        actions: {
                          type: 'joinTeam',
                          params: ({ context, event }) => ({
                            ...event.payload,
                            device: context.device,
                            invitationSeed: context.invitationSeed!,
                            user: context.user,
                          }),
                        },
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
                          actions: {
                            type: 'proveIdentity',
                            params: ({ context, event }) => ({
                              challenge: event.payload.challenge,
                              keys: context.device.keys,
                            }),
                          },
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
                          actions: ['challengeIdentity'],
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
                            guard: ({ context, event }) => {
                              const { challenge, proof } = event.payload
                              return context.team!.verifyIdentityProof(challenge, proof)
                            },
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
          entry: 'sendSeed',
          initial: 'awaitingSeed',
          states: {
            awaitingSeed: {
              on: {
                SEED: {
                  actions: {
                    type: 'deriveSharedKey',
                    params: ({ context, event }) => ({
                      encryptedSeed: event.payload.encryptedSeed,
                      seed: context.seed!,
                      user: context.user!,
                      peer: context.peer!,
                    }),
                  },
                  target: 'doneNegotiating',
                },
              },
              ...timeout,
            },
            doneNegotiating: { type: FINAL },
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
            SYNC: { actions: ['receiveSyncMessage', 'sendSyncMessage'], target: '#connected' },
            // Deliver any encrypted messages
            ENCRYPTED_MESSAGE: {
              actions: {
                type: 'receiveEncryptedMessage',
                params: ({ context, event }) => ({
                  sessionKey: context.sessionKey!,
                  encryptedMessage: event.payload,
                }),
              },
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

    // deliver any messages that were received before we were ready
    for (const m of storedMessages) this.deliver(m)

    return this
  }

  /** Sends a disconnect message to the peer. */
  public stop = () => {
    if (this.started && this.machine.getSnapshot().status !== 'done') {
      const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
      this.machine.send(disconnectMessage) // Send disconnect event to local machine
      this.messageQueue.send(disconnectMessage) // Send disconnect message to peer
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

  /**
   * Public interface for sending an encrypted message from the application to our peer. We don't
   * care about the content of this message.
   */
  public send = (message: any) => {
    assert(this.sessionKey, "Can't send encrypted messages until we've finished connecting")
    const encryptedMessage = symmetric.encryptBytes(message, this.sessionKey)
    this.messageQueue.send({ type: 'ENCRYPTED_MESSAGE', payload: encryptedMessage })
  }

  // PRIVATE

  #logMessage(direction: 'in' | 'out', message: NumberedMessage<ConnectionMessage>) {
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
  ({
    actions: { type: 'fail', params: { error } },
    target: '#disconnected',
  }) as const

const timeout = { after: { [TIMEOUT_DELAY]: fail(TIMEOUT) } } as const
