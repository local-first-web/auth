import { MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionStateSchema } from '/connection/types'
import { ConnectionMessage } from '/message'

export const connectionMachine: MachineConfig<
  ConnectionContext,
  ConnectionStateSchema,
  ConnectionMessage
> = {
  id: 'connection',
  initial: 'disconnected',
  entry: ['sendHello'],

  states: {
    disconnected: {
      on: {
        HELLO: {
          target: 'checkingForInvitation',
        },
      },
    },

    // first we determine if anyone has an invitation to be processed;
    // the mutual authentication part of this requires both sides to be members of the team
    checkingForInvitation: {
      on: { ERROR: 'disconnected' },
      entry: ['receiveHello'],
      initial: 'checking',

      states: {
        checking: {
          always: [
            // we can't both present invitations - someone has to be a member
            {
              cond: 'bothHaveInvitation',
              actions: 'failNeitherIsMember',
              target: 'failure',
            },

            // if I have an invitation, wait for acceptance
            {
              cond: 'iHaveInvitation',
              target: 'awaitingInvitationAcceptance',
            },

            // if they have an invitation, wait for them to send proof
            {
              cond: 'theyHaveInvitation',
              target: 'validatingInvitationProof',
            },

            // otherwise, we're done with this part
            {
              target: 'success',
            },
          ],
        },

        awaitingInvitationAcceptance: {
          on: {
            ACCEPT_INVITATION: {
              actions: ['joinTeam'],
              target: 'success',
            },
          },
        },

        validatingInvitationProof: {
          always: [
            // if the proof succeeds, add them to the team and send a welcome message,
            // then proceed to the standard identity claim & challenge process
            {
              cond: 'invitationProofIsValid',
              actions: 'acceptInvitation',
              target: 'success',
            },
            // if the proof fails, disconnect with error
            {
              actions: 'rejectInvitation',
              target: 'failure',
            },
          ],
        },

        failure: {},

        success: {
          type: 'final',
        },
      },

      onDone: 'authenticating',
    },

    authenticating: {
      // these are two peers, mutually authenticating to each other;
      // so we have to complete two parallel processes:
      // 1. claim an identity and provide proof when challenged
      // 2. verify the other peer's claimed identity
      type: 'parallel',
      on: { ERROR: 'disconnected' },

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
                  // cond: 'identityIsKnown',
                  actions: 'challengeIdentity',
                  target: 'awaitingIdentityProof',
                },
                // if we don't have anybody by that name in the team, disconnect with error
                {
                  actions: 'rejectIdentity',
                  target: 'failure',
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
                    target: 'failure',
                  },
                ],
              },
            },

            failure: {},
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
  },
}
