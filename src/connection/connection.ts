import { Machine } from 'xstate'

interface ConnectionStateSchema {
  states: {
    disconnected: {}
    connecting: {
      states: {
        claimingIdentity: {
          states: {
            awaitingChallenge: {}
            awaitingConfirmation: {}
            success: {}
          }
        }
        verifyingIdentity: {
          states: {
            awaitingClaim: {}
            awaitingProof: {}
            success: {}
          }
        }
      }
    }
    connected: {}
  }
}

type ConnectionEvent =
  | { type: 'CONNECT' }
  | { type: 'RECEIVE_CLAIM' }
  | { type: 'RECEIVE_CHALLENGE' }
  | { type: 'RECEIVE_PROOF' }
  | { type: 'RECEIVE_CONFIRMATION' }
  | { type: 'DISCONNECT' }

interface ConnectionContext {
  claim: any
  proof: any
}

export const connectionMachine = Machine<ConnectionContext, ConnectionStateSchema, ConnectionEvent>(
  {
    id: 'connection',
    initial: 'disconnected',
    states: {
      disconnected: {
        id: 'disconnected',
        on: {
          CONNECT: 'connecting',
        },
      },
      connecting: {
        id: 'connecting',
        type: 'parallel',
        states: {
          claimingIdentity: {
            initial: 'awaitingChallenge',
            states: {
              awaitingChallenge: {
                entry: ['claimIdentity'],
                on: {
                  RECEIVE_CHALLENGE: {
                    actions: ['sendProof'],
                    target: 'awaitingConfirmation',
                  },
                },
              },
              awaitingConfirmation: {
                on: {
                  RECEIVE_CONFIRMATION: {
                    target: 'success',
                  },
                },
              },
              success: {
                type: 'final',
              },
            },
          },
          verifyingIdentity: {
            initial: 'awaitingClaim',
            states: {
              awaitingClaim: {
                on: {
                  RECEIVE_CLAIM: [
                    {
                      cond: { type: 'identityIsKnown' },
                      actions: ['challengeClaim'],
                      target: 'awaitingProof',
                    },
                    {
                      actions: ['sendErrorIdentityUnknown'],
                    },
                  ],
                },
              },
              awaitingProof: {
                on: {
                  RECEIVE_PROOF: [
                    {
                      cond: { type: 'proofIsValid' },
                      actions: ['sendConfirmation'],
                      target: 'success',
                    },
                    {
                      actions: ['sendErrorInvalidProof'],
                    },
                  ],
                },
              },
              success: {
                type: 'final',
              },
            },
          },
        },
        onDone: 'connected',
      },
      connected: {
        type: 'final',
      },
    },
  },
  {
    actions: {
      claimIdentity: (ctx, event) => {},
      sendProof: (ctx, event) => {},
      challengeClaim: (ctx, event) => {},
      sendConfirmation: (ctx, event) => {},
    },
  }
)
