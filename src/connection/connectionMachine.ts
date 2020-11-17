import { MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionStateSchema } from '/connection/types'
import { ConnectionMessage } from '/connection/message'

// common timeout settings
const TIMEOUT_DELAY = 7000
const timeout = { after: { [TIMEOUT_DELAY]: { actions: 'failTimeout', target: '#failure' } } }

export const connectionMachine: MachineConfig<
  ConnectionContext,
  ConnectionStateSchema,
  ConnectionMessage
> = {
  id: 'connection',
  initial: 'disconnected',
  entry: ['sendHello'],

  on: { ERROR: '#failure' },

  states: {
    disconnected: {
      entry: 'onDisconnected',
      on: {
        HELLO: {
          actions: 'receiveHello',
          target: 'initializing',
        },
      },
    },

    // transient state to determine where to start
    initializing: {
      always: [
        // we can't both present invitations - someone has to be a member
        {
          cond: 'bothHaveInvitation',
          actions: ['failNeitherIsMember'],
          target: '#failure',
        },

        // if I have an invitation, wait for acceptance
        {
          cond: 'iHaveInvitation',
          target: 'awaitingInvitationAcceptance',
        },

        // if they have an invitation, validate it
        {
          cond: 'theyHaveInvitation',
          target: 'validatingInvitationProof',
        },

        // otherwise, we can proceed directly to authentication
        {
          target: 'authenticating',
        },
      ],
    },

    awaitingInvitationAcceptance: {
      // wait for them to validate the invitation we've shown
      on: {
        ACCEPT_INVITATION: [
          // make sure the team I'm joining is actually the one that invited me
          {
            cond: 'joinedTheRightTeam',
            actions: 'joinTeam',
            target: 'authenticating',
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

    validatingInvitationProof: {
      always: [
        // if the proof succeeds, add them to the team and send a welcome message,
        // then proceed to the standard identity claim & challenge process
        {
          cond: 'invitationProofIsValid',
          actions: 'acceptInvitation',
          target: 'authenticating',
        },

        // if the proof fails, disconnect with error
        {
          actions: 'rejectInvitation',
          target: '#failure',
        },
      ],
    },

    authenticating: {
      // these are two peers, mutually authenticating to each other;
      // so we have to complete two parallel processes:
      // 1. prove our identity
      // 2. verify our peer's identity
      type: 'parallel',

      states: {
        // 1. prove our identity
        claimingIdentity: {
          initial: 'awaitingIdentityChallenge',
          states: {
            // we claimed our identity already, in our HELLO message; now we wait for a challenge
            awaitingIdentityChallenge: {
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
              on: {
                ACCEPT_IDENTITY: {
                  // save the encrypted seed they provide; we'll use it to derive a shared secret
                  actions: 'storeTheirEncryptedSeed',
                  target: 'done',
                },
              },
              ...timeout,
            },

            done: { type: 'final' },
          },
        },

        // 2. verify the other peer's claimed identity: receive their claim, challenge it, and validate their proof
        verifyingIdentity: {
          initial: 'challengingIdentityClaim',
          states: {
            challengingIdentityClaim: {
              always: [
                // if we have a member by that name on the team, send a challenge
                {
                  cond: 'identityIsKnown',
                  actions: 'challengeIdentity',
                  target: 'awaitingIdentityProof',
                },

                // if we don't have anybody by that name in the team, disconnect with error
                {
                  actions: 'rejectIdentity',
                  target: '#failure',
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
                    actions: ['generateSeed', 'acceptIdentity'],
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

      // Once BOTH processes complete, we are connected
      onDone: 'updating',
    },

    // having established each others' identities, we now make sure that our team signature chains are up to date
    updating: {
      // send our head & filter to tell them what we know
      entry: ['sendUpdate'],
      on: {
        // when they send us their head & filter,
        UPDATE: [
          // if we have the same head, then we're caught up
          {
            cond: 'headsAreEqual',
            target: 'connected',
          },
          // otherwise figure out what links we might have that they're missing, and send them
          {
            actions: 'sendMissingLinks',
            target: 'updating',
          },
        ],

        // when they send us missing links, add them to our chain and start over
        MISSING_LINKS: {
          actions: ['receiveMissingLinks', 'sendUpdate'],
          target: 'updating',
        },
      },
      ...timeout,
    },

    connected: {
      entry: ['deriveSharedKey', 'onConnected'],
      on: {
        DISCONNECT: 'disconnected',
        UPDATE: 'updating',
      },
    },

    failure: {
      id: 'failure',
      always: 'disconnected',
    },
  },
}
