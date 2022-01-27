import { MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionState } from '@/connection/types'
import { ConnectionMessage } from '@/connection/message'

// common timeout settings
const TIMEOUT_DELAY = 7000
const timeout = { after: { [TIMEOUT_DELAY]: { actions: 'failTimeout', target: '#disconnected' } } }

export const protocolMachine: MachineConfig<ConnectionContext, ConnectionState, ConnectionMessage> =
  {
    id: 'connection',
    initial: 'awaitingIdentityClaim',

    on: {
      REQUEST_IDENTITY: { actions: 'sendIdentityClaim', target: 'awaitingIdentityClaim' },
      ERROR: { actions: 'receiveError', target: '#disconnected' }, // remote error (sent by peer)
      LOCAL_ERROR: { actions: 'sendError', target: '#disconnected' }, // local error (detected by us, sent to peer)
    },

    states: {
      awaitingIdentityClaim: {
        id: 'awaitingIdentityClaim',
        on: {
          CLAIM_IDENTITY: { actions: ['receiveIdentityClaim'], target: 'authenticating' },
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
                  // we can't both present invitations - someone has to be a member
                  {
                    cond: 'bothHaveInvitation',
                    actions: 'failNeitherIsMember',
                    target: '#disconnected',
                  },

                  // if I have an invitation, wait for acceptance
                  { cond: 'iHaveInvitation', target: 'awaitingInvitationAcceptance' },

                  // if they have an invitation, validate it
                  { cond: 'theyHaveInvitation', target: 'validatingInvitation' },

                  // otherwise, we can proceed directly to authentication
                  { target: '#checkingIdentity' },
                ],
              },

              awaitingInvitationAcceptance: {
                // wait for them to validate the invitation we've shown
                on: {
                  ACCEPT_INVITATION: [
                    // make sure the team I'm joining is actually the one that invited me
                    {
                      cond: 'joinedTheRightTeam',
                      actions: ['joinTeam', 'onJoined'],
                      target: '#checkingIdentity',
                    },

                    // if it's not, disconnect with error
                    { actions: 'rejectTeam', target: '#disconnected' },
                  ],
                },
                ...timeout,
              },

              validatingInvitation: {
                always: [
                  // if the proof succeeds, add them to the team and send an acceptance message,
                  // then proceed to the standard identity claim & challenge process
                  {
                    cond: 'invitationProofIsValid',
                    actions: 'acceptInvitation',
                    target: '#checkingIdentity',
                  },

                  // if the proof fails, disconnect with error
                  { actions: 'rejectInvitation', target: '#disconnected' },
                ],
              },
            },
          },

          checkingIdentity: {
            id: 'checkingIdentity',

            // peers mutually authenticate to each other, so we have to complete two parallel processes:
            // 1. prove our identity
            // 2. verify their identity
            type: 'parallel',

            states: {
              // 1. prove our identity
              provingMyIdentity: {
                initial: 'awaitingIdentityChallenge',
                states: {
                  awaitingIdentityChallenge: {
                    // if we just presented an invitation, they already know who we are
                    always: { cond: 'iHaveInvitation', target: 'doneProvingMyIdentity' },

                    on: {
                      CHALLENGE_IDENTITY: {
                        // when we receive a challenge, respond with proof
                        actions: ['proveIdentity'],
                        target: 'awaitingIdentityAcceptance',
                      },
                    },
                    ...timeout,
                  },

                  // wait for a message confirming that they've validated our proof of identity
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
                      // if they just presented an invitation, they've already proven their identity - we can move on
                      { cond: 'theyHaveInvitation', target: 'doneVerifyingTheirIdentity' },

                      // we received their identity claim in their CLAIM_IDENTITY message
                      // if we have a member & device by that name on the team, send a challenge
                      {
                        actions: ['confirmIdentityExists', 'challengeIdentity'],
                        target: 'awaitingIdentityProof',
                      },
                    ],
                  },

                  // then wait for them to respond to the challenge with proof
                  awaitingIdentityProof: {
                    on: {
                      PROVE_IDENTITY: [
                        // if the proof succeeds, we're done on our side
                        {
                          cond: 'identityProofIsValid',
                          actions: 'acceptIdentity',
                          target: 'doneVerifyingTheirIdentity',
                        },

                        // if the proof fails, disconnect with error
                        { actions: 'rejectIdentityProof', target: '#disconnected' },
                      ],
                    },
                    ...timeout,
                  },

                  doneVerifyingTheirIdentity: { type: 'final' },
                },
              },
            },

            // Once BOTH processes complete, we continue
            onDone: { actions: 'storePeer', target: 'doneAuthenticating' },
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
          SYNC: { actions: ['receiveSyncMessage', 'sendSyncMessage'], target: '#synchronizing' },
        },
      },

      connected: {
        id: 'connected',

        always: [
          // if the peer is no longer on the team (or no longer has device), disconnect
          { cond: 'peerWasRemoved', actions: 'failPeerWasRemoved', target: 'disconnected' },
        ],

        on: {
          // if something changes locally, send them a sync message
          LOCAL_UPDATE: { actions: ['sendSyncMessage'], target: '#connected' },

          // if they send a sync message, process it
          SYNC: { actions: ['receiveSyncMessage', 'sendSyncMessage'], target: '#connected' },

          // deliver any encrypted messages
          ENCRYPTED_MESSAGE: { actions: 'receiveEncryptedMessage', target: '#connected' },

          DISCONNECT: '#disconnected',
        },
      },

      disconnected: {
        id: 'disconnected',
        entry: 'onDisconnected',
      },
    },
  }
