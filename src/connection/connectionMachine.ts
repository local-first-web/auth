import { MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionStateSchema } from '/connection/types'
import { ConnectionMessage } from '/message'

export const connectionMachine: MachineConfig<
  ConnectionContext,
  ConnectionStateSchema,
  ConnectionMessage
> = {
  id: 'connection',
  initial: 'connecting',

  states: {
    disconnected: {
      on: {
        CONNECT: {
          target: 'connecting',
          actions: ['initialize'],
        },
      },
    },

    connecting: {
      // to connect, we have to complete two parallel processes:
      type: 'parallel',
      on: { ERROR: { target: 'disconnected' } },
      states: {
        // 1. claim an identity and provide proof when challenged
        claimingIdentity: {
          initial: 'initializing',
          states: {
            // first, we determine if anyone is not a member & presenting an invitation
            initializing: {
              onEntry: [
                // we can't both present invitations - someone has to be a member
                {
                  cond: 'bothHaveInvitation',
                  type: 'failNeitherIsMember',
                  target: 'disconnected',
                },
                // if I have an invitation, send proof then wait for acceptance
                {
                  cond: 'iHaveInvitation',
                  type: 'proveInvitation',
                  target: 'awaitingInvitationAcceptance',
                },
                // otherwise, claim my identity then wait for challenge
                {
                  type: 'claimIdentity',
                  target: 'awaitingIdentityChallenge',
                },
              ],
            },

            // then wait for acceptance
            awaitingInvitationAcceptance: {
              on: {
                ACCEPT_INVITATION: {
                  actions: ['joinTeam'],
                  target: 'awaitingIdentityChallenge',
                },
              },
            },

            awaitingIdentityChallenge: {
              // automatically send our identity claim, then wait for a challenge
              on: {
                CHALLENGE_IDENTITY: {
                  // when we receive a challenge, respond with proof
                  actions: ['proveIdentity'],
                  target: 'awaitingIdentityAcceptance',
                },
              },
            },

            // wait for a message confirming that they've verified our identity
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

        // 2. receive the other peer's claimed identity, challenge it, and verify their proof
        verifyingIdentity: {
          initial: 'initializing',
          states: {
            // first, we determine if anyone is not a member & presenting an invitation
            initializing: {
              onEntry: [
                // we can't both present invitations - someone has to be a member
                {
                  cond: 'bothHaveInvitation',
                  type: 'failNeitherIsMember',
                  target: 'disconnected',
                },
              ],
              always: [
                // if they have an invitation, wait for proof of invitation
                {
                  cond: 'theyHaveInvitation',
                  target: 'awaitingInvitationProof',
                },
                // otherwise, wait for identity claim
                {
                  target: 'awaitingIdentityChallenge',
                },
              ],
            },

            awaitingInvitationProof: {
              on: {
                PROVE_INVITATION: [
                  // if the proof succeeds, add them to the team and send a welcome message,
                  // then proceed to the standard identity claim & challenge process
                  {
                    cond: 'invitationProofIsValid',
                    actions: 'acceptInvitation',
                    target: 'awaitingIdentityClaim',
                  },
                  // if the proof fails, disconnect with error
                  {
                    actions: 'rejectInvitation',
                    target: 'disconnected',
                  },
                ],
              },
            },

            // wait for an identity claim
            awaitingIdentityClaim: {
              on: {
                CLAIM_IDENTITY: [
                  // if we have a member by that name on the team, send a challenge
                  {
                    cond: 'identityIsKnown',
                    actions: 'challengeIdentity',
                    target: 'awaitingIdentityProof',
                  },
                  // if we don't have anybody by that name in the team, disconnect with error
                  {
                    actions: 'rejectIdentity',
                    target: 'disconnected',
                  },
                ],
              },
            },

            // then we wait for them to respond to the challenge with proof
            awaitingIdentityProof: {
              on: {
                PROVE_IDENTITY: [
                  {
                    cond: 'identityProofIsValid',
                    actions: 'acceptIdentity',
                    target: 'success',
                  },
                  // if the proof fails, disconnect with error
                  {
                    actions: 'rejectIdentity',
                    target: 'disconnected',
                  },
                ],
              },
            },

            success: { type: 'final' },
          },
        },
      },

      // Once BOTH processes complete, we are connected
      onDone: 'connected',
    },

    connected: {
      onEntry: ['onConnected', 'deriveSecretKey'],
      on: { DISCONNECT: 'disconnected' },
    },
  },
}
