import { type MachineConfig } from 'xstate'
import { type ConnectionMessage } from 'connection/message.js'
import { type ConnectionContext, type ConnectionState } from 'connection/types.js'

// Common timeout settings
const TIMEOUT_DELAY = 7000
const timeout = {
  after: {
    [TIMEOUT_DELAY]: { actions: 'failTimeout', target: '#disconnected' },
  },
}

export const machine: MachineConfig<ConnectionContext, ConnectionState, ConnectionMessage> = {
  id: 'connection',
  initial: 'awaitingIdentityClaim',

  on: {
    REQUEST_IDENTITY: {
      actions: 'sendIdentityClaim',
      target: 'awaitingIdentityClaim',
    },
    ERROR: { actions: 'receiveError', target: '#disconnected' }, // Remote error (sent by peer)
    LOCAL_ERROR: { actions: 'sendError', target: '#disconnected' }, // Local error (detected by us, sent to peer)
  },

  states: {
    awaitingIdentityClaim: {
      id: 'awaitingIdentityClaim',
      on: {
        CLAIM_IDENTITY: {
          actions: ['receiveIdentityClaim'],
          target: 'authenticating',
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
                  cond: 'bothHaveInvitation',
                  actions: 'failNeitherIsMember',
                  target: '#disconnected',
                },

                // If I have an invitation, wait for acceptance
                {
                  cond: 'iHaveInvitation',
                  target: 'awaitingInvitationAcceptance',
                },

                // If they have an invitation, validate it
                { cond: 'theyHaveInvitation', target: 'validatingInvitation' },

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
                    cond: 'joinedTheRightTeam',
                    actions: ['joinTeam', 'onJoined'],
                    target: '#checkingIdentity',
                  },

                  // If it's not, disconnect with error
                  { actions: 'rejectTeam', target: '#disconnected' },
                ],
              },
              ...timeout,
            },

            validatingInvitation: {
              always: [
                // If the proof succeeds, add them to the team and send an acceptance message,
                // then proceed to the standard identity claim & challenge process
                {
                  cond: 'invitationProofIsValid',
                  actions: 'acceptInvitation',
                  target: '#checkingIdentity',
                },

                // If the proof fails, disconnect with error
                { actions: 'rejectInvitation', target: '#disconnected' },
              ],
            },
          },
        },

        checkingIdentity: {
          id: 'checkingIdentity',

          // Peers mutually authenticate to each other, so we have to complete two parallel processes:
          // 1. prove our identity
          // 2. verify their identity
          type: 'parallel',

          states: {
            // 1. prove our identity
            provingMyIdentity: {
              initial: 'awaitingIdentityChallenge',
              states: {
                awaitingIdentityChallenge: {
                  // If we just presented an invitation, they already know who we are
                  always: {
                    cond: 'iHaveInvitation',
                    target: 'doneProvingMyIdentity',
                  },

                  on: {
                    CHALLENGE_IDENTITY: {
                      // When we receive a challenge, respond with proof
                      actions: ['proveIdentity'],
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

                doneProvingMyIdentity: { type: 'final' },
              },
            },

            // 2. verify their identity
            verifyingTheirIdentity: {
              initial: 'challengingIdentity',
              states: {
                challengingIdentity: {
                  always: [
                    // If they just presented an invitation, they've already proven their identity - we can move on
                    {
                      cond: 'theyHaveInvitation',
                      target: 'doneVerifyingTheirIdentity',
                    },

                    // We received their identity claim in their CLAIM_IDENTITY message
                    // if we have a member & device by that name on the team, send a challenge
                    {
                      actions: ['confirmIdentityExists', 'challengeIdentity'],
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
                        cond: 'identityProofIsValid',
                        actions: 'acceptIdentity',
                        target: 'doneVerifyingTheirIdentity',
                      },

                      // If the proof fails, disconnect with error
                      {
                        actions: 'rejectIdentityProof',
                        target: '#disconnected',
                      },
                    ],
                  },
                  ...timeout,
                },

                doneVerifyingTheirIdentity: { type: 'final' },
              },
            },
          },

          // Once BOTH processes complete, we continue
          onDone: { target: 'doneAuthenticating' },
        },

        doneAuthenticating: { type: 'final' },
      },

      onDone: { actions: ['listenForTeamUpdates'], target: '#negotiating' },
    },

    negotiating: {
      id: 'negotiating',
      entry: ['generateSeed'],
      initial: 'awaitingSeed',
      states: {
        awaitingSeed: {
          entry: ['sendSeed'],
          on: { SEED: { actions: 'receiveSeed', target: 'doneNegotiating' } },
          ...timeout,
        },
        doneNegotiating: { entry: 'deriveSharedKey', type: 'final' },
      },

      onDone: {
        actions: ['sendSyncMessage'],
        target: '#synchronizing',
      },
    },

    synchronizing: {
      id: 'synchronizing',

      always: [{ cond: 'headsAreEqual', actions: 'onConnected', target: '#connected' }],

      on: {
        SYNC: {
          actions: ['receiveSyncMessage', 'sendSyncMessage'],
          target: '#synchronizing',
        },
      },
    },

    connected: {
      id: 'connected',

      always: [
        // If the peer is no longer on the team (or no longer has device), disconnect
        {
          cond: 'peerWasRemoved',
          actions: 'failPeerWasRemoved',
          target: 'disconnected',
        },
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
}
