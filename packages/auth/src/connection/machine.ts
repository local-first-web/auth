import { type ConnectionErrorType } from './errors.js'
import { type ConnectionContext } from './types.js'

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
const timeout = {
  after: {
    [TIMEOUT_DELAY]: { actions: 'fail', params: { errorType: TIMEOUT }, target: '#disconnected' },
  },
}

export const machine = {
  context: {} as ConnectionContext,

  id: 'connection',
  initial: 'awaitingIdentityClaim',

  on: {
    REQUEST_IDENTITY: {
      actions: 'sendIdentityClaim',
      target: 'awaitingIdentityClaim',
    },

    CLAIM_IDENTITY: {
      actions: ['receiveIdentityClaim'],
      target: 'awaitingIdentityClaim',
    },

    ERROR: { actions: 'receiveError', target: '#disconnected' }, // Remote error (sent by peer)
    LOCAL_ERROR: { actions: 'sendError', target: '#disconnected' }, // Local error (detected by us, sent to peer)
  },

  states: {
    awaitingIdentityClaim: {
      id: 'awaitingIdentityClaim',
      always: {
        guard: 'bothSentIdentityClaim',
        target: 'authenticating',
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
                  guard: 'bothHaveInvitation',
                  actions: 'fail',
                  params: { errorType: NEITHER_IS_MEMBER },
                  target: '#disconnected',
                },

                // If I have an invitation, wait for acceptance
                {
                  guard: 'weHaveInvitation',
                  target: 'awaitingInvitationAcceptance',
                },

                // If they have an invitation, validate it
                {
                  guard: 'theyHaveInvitation', //
                  target: 'validatingInvitation',
                },

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
                    actions: ['joinTeam'],
                    target: '#checkingIdentity',
                  },

                  // If it's not, disconnect with error
                  {
                    actions: 'fail',
                    params: { errorType: JOINED_WRONG_TEAM },
                    target: '#disconnected',
                  },
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
                {
                  actions: 'fail',
                  params: { errorType: INVITATION_PROOF_INVALID },
                  target: '#disconnected',
                },
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
                  always: {
                    guard: 'weHaveInvitation',
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
                    {
                      guard: 'theyHaveInvitation',
                      target: 'doneVerifyingTheirIdentity',
                    },

                    // We received their identity claim in their CLAIM_IDENTITY message. Do we have a device on the team matching their identity claim?
                    {
                      guard: 'deviceUnknown',
                      actions: 'fail',
                      params: { errorType: DEVICE_UNKNOWN },
                      target: '#disconnected',
                    },

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
                      {
                        actions: 'fail',
                        params: { errorType: INVITATION_PROOF_INVALID },
                        target: '#disconnected',
                      },
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
      entry: ['generateSeed'],
      initial: 'awaitingSeed',
      states: {
        awaitingSeed: {
          entry: ['sendSeed'],
          on: { SEED: { actions: 'receiveSeed', target: 'doneNegotiating' } },
          ...timeout,
        },
        doneNegotiating: { entry: 'deriveSharedKey', type: FINAL },
      },

      onDone: {
        actions: ['sendSyncMessage'],
        target: '#synchronizing',
      },
    },

    synchronizing: {
      id: 'synchronizing',

      always: [{ guard: 'headsAreEqual', actions: 'onConnected', target: '#connected' }],

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
          guard: 'memberWasRemoved',
          actions: 'fail',
          params: { error: MEMBER_REMOVED },
          target: 'disconnected',
        },
        {
          guard: 'deviceWasRemoved',
          actions: 'fail',
          params: { ERROR: DEVICE_REMOVED },
          target: 'disconnected',
        },
        {
          guard: 'serverWasRemoved',
          actions: 'fail',
          params: { ERROR: SERVER_REMOVED },
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
