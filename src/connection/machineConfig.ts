import { MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionEvent, ConnectionStateSchema } from '/connection/types'

export const machineConfig: MachineConfig<
  ConnectionContext,
  ConnectionStateSchema,
  ConnectionEvent
> = {
  id: 'connection',
  initial: 'connecting',

  states: {
    connecting: {
      // to connect, we have to complete two parallel processes:
      type: 'parallel',
      states: {
        // 1. claim an identity and provide proof when challenged
        claimingIdentity: {
          initial: 'awaitingChallenge',
          states: {
            awaitingChallenge: {
              // automatically send our identity claim, then wait for a challenge
              onEntry: 'claim',
              on: {
                CHALLENGE_IDENTITY: {
                  // when we receive a challenge, respond with proof
                  actions: ['prove'],
                  target: 'awaitingAcceptance',
                },
              },
            },

            // wait for a message confirming that they've verified our identity
            awaitingAcceptance: {
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
          initial: 'awaitingClaim',
          states: {
            // first we wait for an identity claim
            awaitingClaim: {
              on: {
                CLAIM_IDENTITY: [
                  // if we have a member by that name on the team, send a challenge
                  {
                    cond: { type: 'identityIsKnown' },
                    actions: 'challenge',
                    target: 'awaitingProof',
                  },
                  // if we don't have anybody by that name in the team
                  // TODO implement this
                  { actions: 'sendErrorIdentityUnknown' },
                ],
              },
            },

            // then we wait for them to respond to the challenge with proof
            awaitingProof: {
              on: {
                PROVE_IDENTITY: [
                  {
                    cond: { type: 'proofIsValid' },
                    actions: 'accept',
                    target: 'success',
                  },
                  // if the proof fails
                  // TODO implement this
                  { actions: 'sendErrorInvalidProof' },
                ],
              },
            },

            success: { type: 'final' },
          },
        },
      },

      // Once both processes complete, we are connected
      onDone: { target: 'connected' },
    },

    connected: {
      onEntry: ['onConnected', 'deriveSecretKey'],
      on: { DISCONNECT: 'disconnected' },
    },

    disconnected: {
      on: { CONNECT: 'connecting' },
    },
  },
}
