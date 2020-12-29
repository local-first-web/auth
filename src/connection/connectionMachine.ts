import { MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionState } from '/connection/types'
import { ConnectionMessage } from '/connection/message'

// common timeout settings
const TIMEOUT_DELAY = 7000
const timeout = { after: { [TIMEOUT_DELAY]: { actions: 'failTimeout', target: '#failure' } } }

export const connectionMachine: MachineConfig<
  ConnectionContext,
  ConnectionState,
  ConnectionMessage
> = {
  id: 'connection',
  initial: 'idle',
  entry: ['sendReady'],

  on: {
    ERROR: {
      actions: 'receiveError',
      target: '#failure',
    },
  },

  states: {
    idle: {
      on: {
        READY: {
          actions: 'sendHello',
          target: 'idle',
        },
        HELLO: {
          actions: ['sendHello', 'receiveHello'],
          target: 'connecting',
        },
      },
    },

    disconnected: {
      id: 'disconnected',
      entry: ['onDisconnected'],
      type: 'final',
    },

    connecting: {
      id: 'connecting',
      initial: 'invitation',

      states: {
        invitation: {
          initial: 'initializing',
          states: {
            initializing: {
              always: [
                // we can't both present invitations - someone has to be a member
                {
                  cond: 'bothHaveInvitation',
                  actions: 'failNeitherIsMember',
                  target: '#failure',
                },

                // if I have an invitation, wait for acceptance
                {
                  cond: 'iHaveInvitation',
                  target: 'waiting',
                },

                // if they have an invitation, validate it
                {
                  cond: 'theyHaveInvitation',
                  target: 'validating',
                },

                // otherwise, we can proceed directly to authentication
                {
                  target: '#authenticating',
                },
              ],
            },

            waiting: {
              // wait for them to validate the invitation we've shown
              on: {
                ACCEPT_INVITATION: [
                  // make sure the team I'm joining is actually the one that invited me
                  {
                    cond: 'joinedTheRightTeam',
                    actions: ['joinTeam', 'onJoined'],
                    target: '#authenticating',
                  },

                  // if it's not, disconnect with error
                  {
                    actions: 'rejectTeam',
                    target: '#failure',
                  },
                ],
              },
              ...timeout,
            },

            validating: {
              always: [
                // if the proof succeeds, add them to the team and send a welcome message,
                // then proceed to the standard identity claim & challenge process
                {
                  cond: 'invitationProofIsValid',
                  actions: 'acceptInvitation',
                  target: '#authenticating',
                },

                // if the proof fails, disconnect with error
                {
                  actions: 'rejectInvitation',
                  target: '#failure',
                },
              ],
            },
          },
        },

        authenticating: {
          id: 'authenticating',

          // peers mutually authenticate to each other, so we have to complete two parallel processes:
          // 1. prove our identity
          // 2. verify their identity
          type: 'parallel',
          states: {
            // 1.
            proving: {
              initial: 'awaitingChallenge',
              states: {
                awaitingChallenge: {
                  // if we just presented an invitation, we can skip this
                  always: {
                    cond: 'iHaveInvitation',
                    target: 'done',
                  },
                  on: {
                    CHALLENGE_IDENTITY: {
                      // we claimed our identity already, in our HELLO message; now we wait for a challenge
                      // when we receive a challenge, respond with proof
                      actions: ['proveIdentity'],
                      target: 'awaitingAcceptance',
                    },
                  },
                  ...timeout,
                },

                // wait for a message confirming that they've validated our proof of identity
                awaitingAcceptance: {
                  on: {
                    ACCEPT_IDENTITY: {
                      target: 'done',
                    },
                  },
                  ...timeout,
                },

                done: { type: 'final' },
              },
            },

            // 2.
            verifying: {
              initial: 'challenging',
              states: {
                challenging: {
                  always: [
                    // if they just presented an invitation, we can skip this
                    {
                      cond: 'theyHaveInvitation',
                      target: 'done',
                    },

                    // we received their identity claim in their HELLO message
                    // if we have a member by that name on the team, send a challenge
                    {
                      cond: 'identityIsKnown',
                      actions: 'challengeIdentity',
                      target: 'waiting',
                    },

                    // if we don't have anybody by that name in the team, disconnect with error
                    {
                      actions: 'rejectIdentity',
                      target: '#failure',
                    },
                  ],
                },

                // then wait for them to respond to the challenge with proof
                waiting: {
                  on: {
                    PROVE_IDENTITY: [
                      // if the proof succeeds, we're done on our side
                      {
                        cond: 'identityProofIsValid',
                        actions: 'acceptIdentity',
                        target: 'done',
                      },

                      // if the proof fails, disconnect with error
                      {
                        actions: 'rejectIdentity',
                        target: '#failure',
                      },
                    ],
                  },
                  ...timeout,
                },

                done: { type: 'final' },
              },
            },
          },

          // Once BOTH processes complete, we continue
          onDone: {
            actions: ['storePeer'],
            target: '#connecting.done',
          },
        },

        done: { type: 'final' },
      },

      // Before connecting, we make sure sure we have the signature chain on both sides
      onDone: {
        target: '#synchronizing',
      },
    },

    // having established each others' identities, we now make sure that our team signature chains are up to date
    synchronizing: {
      id: 'synchronizing',
      initial: 'sendingUpdate',
      on: {
        // when they send us their head & hashes,
        UPDATE: [
          // if we have the same head, then we're caught up
          {
            actions: 'recordTheirHead',
            target: 'synchronizing.receivingUpdate',
          },
        ],

        // when they send us missing links, add them to our chain
        MISSING_LINKS: {
          actions: ['recordTheirHead', 'receiveMissingLinks'],
          target: 'synchronizing.receivingMissingLinks',
        },
      },

      states: {
        sendingUpdate: {
          entry: 'sendUpdate',
          always: 'waiting',
        },

        receivingUpdate: {
          always: [
            // if our heads are equal, we're done
            { cond: 'headsAreEqual', target: 'done' },
            // otherwise see if we have anything they don't
            { target: 'sendingMissingLinks' },
          ],
        },

        sendingMissingLinks: {
          entry: 'sendMissingLinks',
          always: 'waiting',
        },

        receivingMissingLinks: {
          always: [
            // if our heads are now equal, we're done
            { cond: 'headsAreEqual', target: 'done' },
            // otherwise we're waiting for them to get missing links from us & confirm
            { target: 'waiting' },
          ],
          exit: [
            'refreshContext', // we might have received new peer info (e.g. keys)
            'sendUpdate', // either way let them know our status
          ],
        },

        waiting: {},

        done: { type: 'final' },
      },

      onDone: [
        // after our first synchronization, we still need to negotiate a session key
        {
          cond: 'dontHaveSessionkey',
          actions: [
            'listenForUpdates', // add listener to team, so we trigger this process again if needed
            'generateSeed',
          ],
          target: 'negotiating',
        },

        // if the peer is no longer on the team, disconnect
        {
          cond: 'peerWasRemoved',
          actions: 'failPeerWasRemoved',
          target: 'disconnected',
        },

        // on following updates, once we're done syncing we just go back to being connected
        {
          actions: 'onUpdated',
          target: 'connected',
        },
      ],
    },

    negotiating: {
      type: 'parallel',
      states: {
        sendingSeed: {
          initial: 'sending',
          states: {
            sending: {
              entry: 'sendSeed',
              always: 'done',
            },
            done: { type: 'final' },
          },
        },
        receivingSeed: {
          initial: 'waiting',
          on: {
            SEED: {
              actions: 'receiveSeed',
              target: 'receivingSeed.done',
            },
          },
          states: {
            waiting: {},
            done: { type: 'final' },
          },
        },
      },
      onDone: { actions: ['deriveSharedKey', 'onConnected'], target: 'connected' },
    },

    connected: {
      on: {
        DISCONNECT: '#disconnected',

        // if something changes locally, sync back up with them
        LOCAL_UPDATE: {
          cond: 'headsAreDifferent',
          target: '#synchronizing',
        },

        // if they send an update, sync back up with them
        UPDATE: {
          cond: 'headsAreDifferent',
          target: '#synchronizing',
        },
      },
    },

    failure: {
      id: 'failure',
      always: '#disconnected',
    },
  },
}
