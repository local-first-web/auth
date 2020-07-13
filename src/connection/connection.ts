import { assign, createMachine, interpret } from 'xstate'
import { challenge, claim, prove, verify } from '/identity'
import { KeyType, randomKey } from '/keyset'
import {
  AcceptIdentityMessage,
  ChallengeIdentityMessage,
  ClaimIdentityMessage,
  ProveIdentityMessage,
  RejectIdentityMessage,
} from '/message'
import { Team } from '/team'
import { User } from '/user'

const { MEMBER } = KeyType

export interface ConnectionStateSchema {
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

export type ConnectionEvent =
  | { type: 'CONNECT' }
  | ClaimIdentityMessage
  | ChallengeIdentityMessage
  | ProveIdentityMessage
  | AcceptIdentityMessage
  | RejectIdentityMessage
  | { type: 'DISCONNECT' }

export interface ConnectionContext {
  team: Team
  user: User
  challenge?: ChallengeIdentityMessage
}

export type ConnectionState = {
  value:
    | 'disconnected'
    | {
        connecting:
          | { claimingIdentity: 'awaitingChallenge' | 'awaitingConfirmation' }
          | { verifyingIdentity: 'awaitingClaim' | 'awaitingProof' }
      }
    | 'connected'
  context: ConnectionContext
}

type SendFunction = (message: ConnectionEvent) => void

export class ConnectionService {
  private sendMessage: SendFunction = message => {
    throw new Error('Send must be implemented')
  }

  private context: ConnectionContext

  constructor(options: { sendMessage: SendFunction; context: ConnectionContext }) {
    const { sendMessage, context } = options
    this.sendMessage = sendMessage
    this.context = context
  }

  public start = () => {
    const machine = this.connectionMachine.withContext(this.context)
    const service = interpret(machine)
    return service.start()
  }

  private connectionMachine = createMachine<ConnectionContext, ConnectionEvent, ConnectionState>(
    {
      id: 'connection',
      initial: 'disconnected',
      states: {
        disconnected: {
          id: 'disconnected',
          on: { CONNECT: 'connecting' },
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
                    CHALLENGE_IDENTITY: {
                      actions: ['sendProof'],
                      target: 'awaitingConfirmation',
                    },
                  },
                },
                awaitingConfirmation: {
                  on: { ACCEPT_IDENTITY: { target: 'success' } },
                },
                success: { type: 'final' },
              },
            },
            verifyingIdentity: {
              initial: 'awaitingClaim',
              states: {
                awaitingClaim: {
                  on: {
                    CLAIM_IDENTITY: [
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
                    PROVE_IDENTITY: [
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
                success: { type: 'final' },
              },
            },
          },
          onDone: 'connected',
        },
        connected: { type: 'final' },
      },
    },
    {
      actions: {
        claimIdentity: (context, event) => {
          const { user } = context
          const claimMessage = claim({ type: MEMBER, name: user.userName })
          this.sendMessage(claimMessage)
        },

        challengeClaim: (context, event) => {
          const claimMessage = event as ClaimIdentityMessage

          const challengeMessage = challenge(claimMessage)

          // store our challenge in context so we can confirm later
          context.challenge = challengeMessage

          this.sendMessage(challengeMessage)
        },

        sendProof: (context, event) => {
          const { user } = context
          const proofMessage = prove(event as ChallengeIdentityMessage, user.keys)
          this.sendMessage(proofMessage)
        },

        sendConfirmation: (context, event) => {
          const confirmMessage: AcceptIdentityMessage = {
            type: 'ACCEPT_IDENTITY',
            payload: { nonce: randomKey() },
          }
          this.sendMessage(confirmMessage)
        },
      },
      guards: {
        identityIsKnown: (context, event) => {
          const claim = (event as ClaimIdentityMessage).payload
          const userName = claim.name
          const { team } = context
          return team.has(userName)
        },

        proofIsValid: (context, event) => {
          const { team, challenge } = context
          const proofMessage = event as ProveIdentityMessage
          const userName = challenge!.payload.name!
          const publicKeys = team.members(userName).keys
          const validation = verify(challenge!, proofMessage, publicKeys)
          return validation.isValid
        },
      },
    }
  )
}
