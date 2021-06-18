import { MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionState } from '@/connection/types'
import { ConnectionMessage } from '@/connection/message'

// common timeout settings
const TIMEOUT_DELAY = 7000
const timeout = { after: { [TIMEOUT_DELAY]: { actions: 'failTimeout', target: '#failure' } } }

export const protocolMachine: MachineConfig<
  ConnectionContext,
  ConnectionState,
  ConnectionMessage
> = {
  id: 'connection',
  initial: 'idle',

  on: {
    // TODO rename READY to REQUEST_IDENTITY
    // TODO rename sendHello to claimIdentity
    READY: {
      actions: 'sendHello',
      target: 'idle',
    },
    ERROR: {
      actions: 'receiveError',
      target: '#failure',
    },
  },

  states: {
    // TODO rename idle to awaitingIdentityClaim
    idle: {
      id: 'idle',
      on: {
        // TODO rename HELLO to CLAIM_IDENTITY
        HELLO: {
          actions: ['receiveHello'],
          target: 'connecting',
        },
      },
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
            // 1. prove our identity
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

                done: {
                  type: 'final',
                },
              },
            },

            // 2. verify their identity
            verifying: {
              initial: 'challenging',
              states: {
                challenging: {
                  always: [
                    // if they just presented an invitation, they've already proven their identity - we can move on
                    {
                      cond: 'theyHaveInvitation',
                      target: 'done',
                    },

                    // we received their identity claim in their HELLO message
                    // if we have a member & device by that name on the team, send a challenge
                    {
                      actions: ['confirmIdentityExists', 'challengeIdentity'],
                      target: 'waiting',
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
                        actions: 'rejectIdentityProof',
                        target: '#failure',
                      },
                    ],
                  },
                  ...timeout,
                },

                done: {
                  type: 'final',
                },
              },
            },
          },

          // Once BOTH processes complete, we continue
          onDone: {
            actions: ['storePeer'],
            target: '#connecting.done',
          },
        },

        done: {
          type: 'final',
        },
      },

      onDone: [
        {
          actions: 'sendSyncMessage',
          target: '#synchronizing',
        },
      ],
    },

    synchronizing: {
      // having established each others' identities, we now make sure that our team signature chains are up to date
      id: 'synchronizing',
      always: {
        cond: 'headsAreEqual',
        actions: 'listenForTeamUpdates',
        target: '#negotiating',
      },
      on: {
        SYNC: {
          actions: ['receiveSyncMessage', 'sendSyncMessage'],
          target: '#synchronizing',
        },
      },
    },

    negotiating: {
      id: 'negotiating',
      type: 'parallel',
      entry: 'generateSeed',
      states: {
        sendingSeed: {
          initial: 'sending',
          states: {
            sending: {
              entry: 'sendSeed',
              always: 'done',
            },
            done: {
              type: 'final',
            },
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
            waiting: {
              ...timeout,
            },
            done: {
              type: 'final',
            },
          },
        },
      },
      onDone: {
        actions: ['deriveSharedKey', 'onConnected'],
        target: 'connected',
      },
    },

    connected: {
      // entry: , // add listener to team, so we sync any further updates as needed

      always: {
        cond: 'peerWasRemoved',
        actions: 'failPeerWasRemoved',
        target: 'disconnected',
      },

      on: {
        // if something changes locally, send them a sync message
        LOCAL_UPDATE: {
          actions: ['sendSyncMessage'],
        },

        // if they send a sync message, process it
        SYNC: {
          actions: [
            {
              cond: 'headsAreDifferent',
              type: 'receiveSyncMessage',
            },
          ],
          target: [
            // if the peer is no longer on the team, disconnect
            'connected',
          ],
        },

        // deliver any encrypted messages
        ENCRYPTED_MESSAGE: {
          actions: ['receiveEncryptedMessage'],
          target: 'connected',
        },

        DISCONNECT: '#disconnected',
      },
    },

    failure: {
      id: 'failure',
      always: '#disconnected',
    },

    disconnected: {
      id: 'disconnected',
      entry: ['onDisconnected'],
    },
  },
}
