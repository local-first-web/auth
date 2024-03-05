/* eslint-disable object-shorthand */
import { EventEmitter } from '@herbcaudill/eventemitter42'
import type { DecryptFnParams } from '@localfirst/crdx'
import {
  generateMessage,
  headsAreEqual,
  initSyncState,
  receiveMessage,
  redactKeys,
} from '@localfirst/crdx'
import { asymmetric, randomKeyBytes, symmetric, type Hash } from '@localfirst/crypto'
import { assert, debug } from '@localfirst/shared'
import { deriveSharedKey } from 'connection/deriveSharedKey.js'
import {
  DEVICE_REMOVED,
  DEVICE_UNKNOWN,
  INVITATION_PROOF_INVALID,
  JOINED_WRONG_TEAM,
  MEMBER_REMOVED,
  NEITHER_IS_MEMBER,
  SERVER_REMOVED,
  TIMEOUT,
  createErrorMessage,
  type ConnectionErrorType,
  IDENTITY_PROOF_INVALID,
  ENCRYPTION_FAILURE,
} from 'connection/errors.js'
import { getDeviceUserFromGraph } from 'connection/getDeviceUserFromGraph.js'
import * as identity from 'connection/identity.js'
import type { ConnectionMessage, DisconnectMessage } from 'connection/message.js'
import { redactDevice } from 'device/index.js'
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
import { extendServerContext, getUserName, messageSummary, stateSummary } from './helpers.js'
import type { ConnectionContext, ConnectionEvents, Context, IdentityClaim } from './types.js'
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
  readonly #machine
  readonly #messageQueue: MessageQueue<ConnectionMessage>
  #started = false
  #log = debug.extend('auth:connection')

  constructor({ sendMessage, context }: ConnectionParams) {
    super()

    this.#messageQueue = this.#initializeMessageQueue(sendMessage)
    this.#log = this.#log.extend(getUserName(context)) // add our name to the debug logger

    // On sync server, the server keys act as both user keys and device keys
    const initialContext = isServerContext(context) ? extendServerContext(context) : context

    const machine = setup({
      types: {
        context: {} as ConnectionContext,
        events: {} as ConnectionMessage,
      },
      actions: {
        // IDENTITY CLAIMS

        requestIdentityClaim: () => {
          this.#queueMessage('REQUEST_IDENTITY')
        },

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
          this.#queueMessage('CLAIM_IDENTITY', ourIdentityClaim)

          return { ourIdentityClaim }
        }),

        receiveIdentityClaim: assign(({ event }) => {
          assertEvent(event, 'CLAIM_IDENTITY')
          const identityClaim = event.payload
          const theirDevice = 'device' in identityClaim ? identityClaim.device : undefined
          return { theirIdentityClaim: identityClaim, theirDevice }
        }),

        // INVITATIONS

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

          // Welcome them by sending the team's graph, so they can reconstruct team membership state
          this.#queueMessage('ACCEPT_INVITATION', {
            serializedGraph: team.save(),
            teamKeyring: team.teamKeyring(),
          })

          return { peer }
        }),

        joinTeam: assign(({ context, event }) => {
          assertEvent(event, 'ACCEPT_INVITATION')
          const { serializedGraph, teamKeyring } = event.payload
          const { device, invitationSeed } = context
          assert(invitationSeed)

          const user =
            context.user ??
            // If we're joining as a new device for an existing member, we won't have a user object
            // yet, so we need to get those from the graph. We use the invitation seed to generate
            // the starter keys for the new device. We can use these to unlock a lockbox on the team
            // graph that contains our user keys.
            getDeviceUserFromGraph({ serializedGraph, teamKeyring, invitationSeed })

          // When admitting us, our peer added our user to the team graph. We've been given the
          // serialized and encrypted graph, and the team keyring. We can now decrypt the graph and
          // reconstruct the team in order to join it.
          const team = new Team({ source: serializedGraph, context: { user, device }, teamKeyring })

          // We join the team, which adds our device to the team graph.
          team.join(teamKeyring)
          this.emit('joined', { team, user })
          return { user, team }
        }),

        // AUTHENTICATION

        challengeIdentity: assign(({ context }) => {
          const { team, theirIdentityClaim } = context
          assert(team) // If we're not on the team yet, we don't have a way of knowing if the peer is
          assert(isMemberClaim(theirIdentityClaim!)) // This is only for members authenticating with deviceId

          // look up their device and user info on the team
          const { deviceId } = theirIdentityClaim
          const theirDevice = team.device(deviceId, { includeRemoved: true })
          const peer = team.memberByDeviceId(deviceId, { includeRemoved: true })

          // we now have a user name so add that to the debug logger
          this.#log = this.#log.extend(peer.userName)

          // send them an identity challenge
          const challenge = identity.challenge({ type: KeyType.DEVICE, name: deviceId })
          this.#queueMessage('CHALLENGE_IDENTITY', { challenge })

          // record their identity info and the challenge in context
          return { theirDevice, peer, challenge }
        }),

        proveIdentity: ({ context, event }) => {
          assertEvent(event, 'CHALLENGE_IDENTITY')
          const { challenge } = event.payload
          const { keys } = context.device
          const proof = identity.prove(challenge, keys)
          this.#queueMessage('PROVE_IDENTITY', { challenge, proof })
        },

        acceptIdentity: () => this.#queueMessage('ACCEPT_IDENTITY'),

        // SYNCHRONIZATION

        listenForTeamUpdates: ({ context }) => {
          assert(context.team)
          context.team.on('updated', ({ head }: { head: Hash[] }) => {
            if (this.#machine.getSnapshot().status !== 'done') {
              this.#machine.send({ type: 'LOCAL_UPDATE', payload: { head } }) // Send update event to local machine
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
            this.#log('sending sync message', syncMessageSummary(syncMessage))
            this.#queueMessage('SYNC', syncMessage)
          } else {
            this.#log('no sync message to send')
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

        // SHARED SECRET NEGOTIATION

        sendSeed: assign(({ context }) => {
          const { user, peer, seed = randomKeyBytes() } = context
          const encryptedSeed = asymmetric.encryptBytes({
            secret: seed,
            recipientPublicKey: peer!.keys.encryption,
            senderSecretKey: user!.keys.encryption.secretKey,
          })

          this.#queueMessage('SEED', { encryptedSeed })
          return { seed }
        }),

        deriveSharedKey: assign(({ context, event }) => {
          assertEvent(event, 'SEED')
          const { encryptedSeed } = event.payload
          const { seed, user, peer } = context

          // decrypt the seed they sent
          try {
            const theirSeed = asymmetric.decryptBytes({
              cipher: encryptedSeed,
              senderPublicKey: peer!.keys.encryption,
              recipientSecretKey: user!.keys.encryption.secretKey,
            })
            // With the two keys, we derive a shared key
            return { sessionKey: deriveSharedKey(seed, theirSeed) }
          } catch (error) {
            if (String(error).includes('incorrect key pair')) {
              return this.#fail(ENCRYPTION_FAILURE)
            } else throw error
          }
        }),

        // ENCRYPTED COMMUNICATION

        receiveEncryptedMessage: ({ context, event }) => {
          assertEvent(event, 'ENCRYPTED_MESSAGE')
          const sessionKey = context.sessionKey!
          const encryptedMessage = event.payload

          try {
            const decryptedMessage = symmetric.decryptBytes(encryptedMessage, sessionKey)
            this.emit('message', decryptedMessage)
          } catch (error) {
            if (String(error).includes('wrong secret key')) {
              return this.#fail(ENCRYPTION_FAILURE)
            } else throw error
          }
        },

        // FAILURE

        fail: assign((_, { error }: { error: ConnectionErrorType }) => {
          return this.#fail(error)
        }),

        receiveError: assign(({ event }) => {
          assertEvent(event, 'ERROR')
          const error = event.payload
          this.#log('receiveError: %o', error)
          this.emit('remoteError', error)
          return { error }
        }),

        sendError: assign(({ event }) => {
          assertEvent(event, 'LOCAL_ERROR')
          const error = event.payload
          this.#log('sendError %o', error)
          this.#messageQueue.send(createErrorMessage(error.type, 'REMOTE'))
          this.emit('localError', error)
          return { error }
        }),

        // EVENTS FOR EXTERNAL LISTENERS

        onConnected: () => this.emit('connected'),
        onDisconnected: ({ event }) => this.emit('disconnected', event),
      },
      guards: {
        theySentIdentityClaim: ({ context }) => context.theirIdentityClaim !== undefined,
        weSentIdentityClaim: ({ context }) => context.ourIdentityClaim !== undefined,
        bothSentIdentityClaim: and(['theySentIdentityClaim', 'weSentIdentityClaim']),

        weHaveInvitation: ({ context }) => isInviteeContext(context),
        theyHaveInvitation: ({ context }) => isInviteeClaim(context.theirIdentityClaim!),
        neitherIsMember: and(['weHaveInvitation', 'theyHaveInvitation']),
        invitationIsValid: ({ context }) => {
          const { team, theirIdentityClaim } = context
          assert(isInviteeClaim(theirIdentityClaim!))
          return team!.validateInvitation(theirIdentityClaim.proofOfInvitation).isValid
        },

        joinedTheRightTeam: ({ context, event }) => {
          assertEvent(event, 'ACCEPT_INVITATION')
          const invitationSeed = context.invitationSeed!
          const { serializedGraph, teamKeyring } = event.payload

          // Make sure my invitation exists on the graph of the team I'm about to join. This check
          // prevents an attack in which a fake team pretends to accept my invitation.
          const state = getTeamState(serializedGraph, teamKeyring)
          const { id } = invitations.generateProof(invitationSeed)
          return select.hasInvitation(state, id)
        },

        deviceUnknown: ({ context }) => {
          const { theirIdentityClaim } = context
          // This is only for existing members (authenticating with deviceId rather than invitation)
          assert(isMemberClaim(theirIdentityClaim!))
          return !context.team!.hasDevice(theirIdentityClaim.deviceId, { includeRemoved: true })
        },

        identityIsValid: ({ context, event }) => {
          assertEvent(event, 'PROVE_IDENTITY')
          const { challenge, proof } = event.payload
          return context.team!.verifyIdentityProof(challenge, proof)
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
      entry: 'requestIdentityClaim',
      initial: 'awaitingIdentityClaim',
      on: {
        REQUEST_IDENTITY: { actions: 'sendIdentityClaim', target: '.awaitingIdentityClaim' },
        // Remote error (sent by peer)
        ERROR: { actions: 'receiveError', target: '#disconnected' },
        // Local error (detected by us, sent to peer)
        LOCAL_ERROR: { actions: 'sendError', target: '#disconnected' },
      },
      states: {
        awaitingIdentityClaim: {
          // Don't respond to a request for an identity claim if we've already sent one
          always: { guard: 'bothSentIdentityClaim', target: 'authenticating' },
          on: { CLAIM_IDENTITY: { actions: 'receiveIdentityClaim' } },
        },
        authenticating: {
          initial: 'checkingInvitations',
          states: {
            checkingInvitations: {
              always: [
                // We can't both present invitations - someone has to be a member
                { guard: 'neitherIsMember', ...fail(NEITHER_IS_MEMBER) },
                // If I have an invitation, wait for acceptance
                { guard: 'weHaveInvitation', target: 'awaitingInvitationAcceptance' },
                // If they have an invitation, validate it
                { guard: 'theyHaveInvitation', target: 'validatingInvitation' },
                // If there are no invitations, we can proceed directly to verifying each other's identity
                { target: '#checkingIdentity' },
              ],
            },
            awaitingInvitationAcceptance: {
              // Wait for them to validate the invitation we included in our identity claim
              on: {
                ACCEPT_INVITATION: [
                  // Make sure the team I'm joining is actually the one that invited me
                  { guard: 'joinedTheRightTeam', actions: 'joinTeam', target: '#checkingIdentity' },
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
                  guard: 'invitationIsValid',
                  actions: 'acceptInvitation',
                  target: '#checkingIdentity',
                },
                // If the proof fails, disconnect with error
                fail(INVITATION_PROOF_INVALID),
              ],
            },
            checkingIdentity: {
              id: 'checkingIdentity',
              // Note that this signature challenge on its own could be vulnerable to a replay
              // attack, in which Eve simultaneously impersonates Alice while initiating a
              // connection to Bob, and impersonates Bob while initiating a connection to Alice.
              //
              // That's OK, because what really matters authentication-wise is not the
              // `authenticating` step but the `negotiating` step: The two parties are only able to
              // converge on a shared secret if they each have the secret key corresponding to their
              // public key. Since that secret is used to encrypt all subsequent communication, that
              // communication is guaranteed to be with the peer whose public key we know.
              //
              // As discussed [here](https://github.com/local-first-web/auth/discussions/42) I
              // considered dropping this step altogether, but it doesn't hurt anything and it's an
              // additional layer of protection.

              type: 'parallel',
              // Peers mutually authenticate to each other, so we have to complete two 'parallel' processes:
              // 1. prove our identity
              // 2. verify their identity
              states: {
                // 1. prove our identity
                provingMyIdentity: {
                  initial: 'awaitingIdentityChallenge',
                  states: {
                    awaitingIdentityChallenge: {
                      // If we just presented an invitation, they already know who we are
                      always: { guard: 'weHaveInvitation', target: 'done' },
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
                      on: { ACCEPT_IDENTITY: { target: 'done' } },
                      ...timeout,
                    },
                    done: { type: 'final' },
                  },
                },
                // 2. verify their identity
                verifyingTheirIdentity: {
                  initial: 'challengingIdentity',
                  states: {
                    challengingIdentity: {
                      always: [
                        // If they just presented an invitation, they've already proven their
                        // identity - we can move on
                        { guard: 'theyHaveInvitation', target: 'done' },
                        // We received their identity claim in their CLAIM_IDENTITY message. Do we
                        // have a device on the team matching their identity claim?
                        { guard: 'deviceUnknown', ...fail(DEVICE_UNKNOWN) },
                        // Send a challenge.
                        { actions: 'challengeIdentity', target: 'awaitingIdentityProof' },
                      ],
                    },
                    // Then wait for them to respond to the challenge with proof
                    awaitingIdentityProof: {
                      on: {
                        PROVE_IDENTITY: [
                          // If the proof succeeds, we're done on our side
                          { guard: 'identityIsValid', actions: 'acceptIdentity', target: 'done' },
                          // If the proof fails, disconnect with error
                          fail(IDENTITY_PROOF_INVALID),
                        ],
                      },
                      ...timeout,
                    },
                    done: { type: 'final' },
                  },
                },
              },
              // Once BOTH processes complete, we continue
              onDone: { target: 'done' },
            },
            done: { type: 'final' },
          },
          onDone: { target: '#negotiating' },
        },
        // Negotiate a shared key
        negotiating: {
          id: 'negotiating',
          entry: 'sendSeed',
          on: { SEED: { actions: 'deriveSharedKey', target: 'synchronizing' } },
          ...timeout,
        },
        // Synchronize our team graph with the peer
        synchronizing: {
          entry: 'sendSyncMessage',
          always: { guard: 'headsAreEqual', target: 'connected' },
          on: { SYNC: { actions: ['receiveSyncMessage', 'sendSyncMessage'] } },
        },
        connected: {
          id: 'connected',
          entry: ['onConnected', 'listenForTeamUpdates'],
          always: [
            // If the member, user, or server has been removed from the team, disconnect
            { guard: 'memberWasRemoved', ...fail(MEMBER_REMOVED) },
            { guard: 'deviceWasRemoved', ...fail(DEVICE_REMOVED) },
            { guard: 'serverWasRemoved', ...fail(SERVER_REMOVED) },
          ],
          on: {
            // If the team graph is modified locally, send them a sync message
            LOCAL_UPDATE: { actions: 'sendSyncMessage' },
            // If they send a sync message, process it
            SYNC: { actions: ['receiveSyncMessage', 'sendSyncMessage'] },
            // Deliver any encrypted messages
            ENCRYPTED_MESSAGE: { actions: 'receiveEncryptedMessage' },
            // If they disconnect we disconnect
            DISCONNECT: '#disconnected',
          },
        },
        disconnected: {
          id: 'disconnected',
          always: { actions: 'onDisconnected' },
          // type: 'final',
        },
      },
    })

    // Instantiate the state machine
    this.#machine = createActor(machine)

    // emit and log all transitions
    this.#machine.subscribe(state => {
      const summary = stateSummary(state.value as string)
      this.emit('change', summary)
      this.#log(`⏩ ${summary} `)
    })

    // add automatic logging to all events
    this.emit = (event, ...args) => {
      this.#log(`emit ${event} %o`, ...args)
      return super.emit(event, ...args)
    }
  }

  // PUBLIC API

  /** Starts the state machine. Returns this Connection object. */
  public start = (storedMessages: Uint8Array[] = []) => {
    this.#log('starting')
    this.#machine.start()
    this.#messageQueue.start()
    this.#started = true

    // if incoming messages were received before we existed, queue them up for the machine
    for (const m of storedMessages) this.deliver(m)

    return this
  }

  /** Shuts down and sends a disconnect message to the peer. */
  public stop = () => {
    if (this.#started && this.#machine.getSnapshot().status !== 'done') {
      const disconnectMessage: DisconnectMessage = { type: 'DISCONNECT' }
      this.#machine.send(disconnectMessage) // Send disconnect event to local machine
      this.#messageQueue.send(disconnectMessage) // Send disconnect message to peer
    }

    this.removeAllListeners()
    this.#messageQueue.stop()
    this.#log('connection stopped')
    return this
  }

  /**
   * Adds connection messages from the peer to the MessageQueue's incoming message queue, which
   * will pass them to the state machine in order.
   */
  public deliver(serializedMessage: Uint8Array) {
    const message = unpack(serializedMessage) as NumberedMessage<ConnectionMessage>
    this.#messageQueue.receive(message)
  }

  /**
   * Public interface for sending a message from the application to our peer via this connection's
   * encrypted channel. We don't care about the content of this message.
   */
  public send = (message: any) => {
    assert(this._sessionKey, "Can't send encrypted messages until we've finished connecting")
    const encryptedMessage = symmetric.encryptBytes(message, this._sessionKey)
    this.#queueMessage('ENCRYPTED_MESSAGE', encryptedMessage)
  }

  /** Returns the current state of the protocol machine.  */
  get state() {
    assert(this.#started)
    return this.#machine.getSnapshot().value
  }

  // PUBLIC FOR TESTING

  /**
   * Returns the team that the connection's user is a member of. If the user has not yet joined a
   * team, returns undefined.
   */
  get team() {
    return this._context.team
  }

  // PRIVATE

  /**
   * Returns the connection's session key when we are in a connected state. Otherwise, returns
   * `undefined`.
   */
  get _sessionKey() {
    return this._context.sessionKey
  }

  get _context(): ConnectionContext {
    assert(this.#started)
    return this.#machine.getSnapshot().context
  }

  #initializeMessageQueue(sendMessage: (message: Uint8Array) => void) {
    // To send messages to our peer, we give them to the ordered message queue, which will deliver
    // them using the `sendMessage` function provided.
    return new MessageQueue<ConnectionMessage>({
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
          this.#messageQueue.resend(index)
        } else {
          // Pass other messages from peer to the state machine
          this.#machine.send(message)
        }
      })
      .on('request', index => {
        // Send out requests to resend messages that we missed
        this.#queueMessage('REQUEST_RESEND', { index })
      })
  }

  /** Force local error state */
  #fail = (error: ConnectionErrorType) => {
    this.#log('error: %o', error)
    const localMessage = createErrorMessage(error, 'LOCAL')
    this.#machine.send(localMessage)
    return { error: localMessage.payload }
  }

  /** Shorthand for sending a message to our peer. */
  #queueMessage<
    M extends ConnectionMessage, //
    T extends M['type'],
    P extends //
      M extends { payload: any } ? M['payload'] : undefined,
  >(type: T, payload?: P) {
    this.#messageQueue.send({ type, payload } as M)
  }

  #logMessage(direction: 'in' | 'out', message: NumberedMessage<ConnectionMessage>) {
    const arrow = direction === 'in' ? '<-' : '->'
    const peerUserName = this.#started ? this._context.peer?.userName ?? '?' : '?'
    this.#log(`${arrow}${peerUserName} #${message.index} ${messageSummary(message)}`)
  }
}

// MACHINE CONFIG FRAGMENTS
// These are snippets of XState config that are used repeatedly in the machine definition.

// error handler
const fail = (error: ConnectionErrorType) =>
  ({
    actions: [{ type: 'fail', params: { error } }, 'onDisconnected'],
    target: '#disconnected',
  }) as const

// timeout configuration
const TIMEOUT_DELAY = 7000
const timeout = { after: { [TIMEOUT_DELAY]: fail(TIMEOUT) } } as const

// TYPES

export type ConnectionParams = {
  /** A function to send messages to our peer. This how you hook this up to your network stack. */
  sendMessage: (message: Uint8Array) => void

  /** The initial context. */
  context: Context
}
