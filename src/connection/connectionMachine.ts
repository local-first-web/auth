import { assign, MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionStateSchema } from '/connection/types'
import { AcceptInvitationMessage, ConnectionMessage, HelloMessage } from '/message'
import { Team } from '/team'

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
          actions: assign((context, message) => {
            const helloMessage = message as HelloMessage
            const { payload } = helloMessage
            return {
              ...context,
              theirIdentityClaim: payload.identityClaim,
              theyHaveInvitation: payload.proofOfInvitation !== undefined ? true : false,
              theirProofOfInvitation: payload.proofOfInvitation,
            }
          }),

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
        ACCEPT_INVITATION: {
          actions: assign((context, event) => {
            const welcomeMessage = event as AcceptInvitationMessage
            const { chain } = welcomeMessage.payload
            const team = new Team({ source: chain, context: { user: context.user } })
            // TODO: add current device?
            return { ...context, team }
          }),
          target: 'authenticating',
        },
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
      // 1. claim an identity
      // 2. verify our peer's identity
      type: 'parallel',

      states: {
        // 1. claim an identity and provide proof when challenged
        claimingIdentity: {
          initial: 'awaitingIdentityChallenge',
          states: {
            awaitingIdentityChallenge: {
              // wait for a challenge
              on: {
                CHALLENGE_IDENTITY: {
                  // when we receive a challenge, respond with proof
                  actions: ['proveIdentity'],
                  target: 'awaitingIdentityAcceptance',
                },
              },
              ...timeout,
            },

            // wait for a message confirming that they've validated our identity
            awaitingIdentityAcceptance: {
              on: {
                ACCEPT_IDENTITY: {
                  // save the encrypted seed they provide; we'll use it to derive a shared secret
                  actions: ['saveSeed'],
                  target: 'success',
                },
              },
              ...timeout,
            },

            success: { type: 'final' },
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
                  // if the proof succeeds, we're done on this side
                  {
                    cond: 'identityProofIsValid',
                    actions: 'acceptIdentity',
                    target: 'success',
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

            success: { type: 'final' },
          },
        },
      },

      // Once BOTH processes complete, we are connected
      onDone: 'connected',
    },

    connected: {
      entry: ['onConnected', 'deriveSecretKey'],
      on: { DISCONNECT: 'disconnected' },
    },

    failure: {
      id: 'failure',
      entry: 'onError',
      always: 'disconnected',
    },
  },
}
