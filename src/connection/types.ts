import { ActionFunction, AssignAction, ConditionPredicate } from 'xstate'
import { ConnectionMessage } from '/connection/message'
import { PublicDevice } from '/device'
import { ProofOfInvitation } from '/invitation'
import { KeyScope } from '/keyset'
import { Member } from '/member'
import { Team } from '/team'
import { User } from '/user'
import { Base64, Hash, UnixTimestamp } from '/util'

// Identity

export type Challenge = KeyScope & {
  nonce: Base64
  timestamp: UnixTimestamp
}

// Context schema

export type SendFunction = <T extends ConnectionMessage>(message: T) => void

// TODO: it's probably redundant to include the device on the connection context, since the user has it

export type InitialContext = {
  /** The local user, including their secret keys */
  user: User
  /** If we already belong to the team, we pass the team object we both belong to */
  team?: Team
  /** If we've just been invited, we provide the invitation secret key that we've been given  */
  invitationSeed?: string
}

/** Parameters needed to instantiate a connection  */
export interface ConnectionParams {
  /** A function to send messages to our peer (this is how you hook this up to your network stack) */
  sendMessage: SendFunction
  context: InitialContext
}

export type ConnectionContext = InitialContext & {
  theyHaveInvitation?: boolean
  theirIdentityClaim?: KeyScope
  theirProofOfInvitation?: ProofOfInvitation
  challenge?: Challenge
  peer?: Member
  theirHead?: Hash
  seed?: Base64
  theirEncryptedSeed?: Base64
  sessionKey?: Base64
  error?: {
    message: string
    details?: any
  }
}

export type Action =
  | ActionFunction<ConnectionContext, ConnectionMessage>
  | AssignAction<ConnectionContext, ConnectionMessage>
export type Condition = ConditionPredicate<ConnectionContext, ConnectionMessage>

// State schema

export interface ConnectionState {
  states: {
    idle: {}
    disconnected: {}
    connecting: {
      states: {
        invitation: {
          states: {
            initializing: {}
            waiting: {}
            validating: {}
          }
        }
        authenticating: {
          states: {
            proving: {
              states: {
                awaitingChallenge: {}
                awaitingAcceptance: {}
                done: {}
              }
            }
            verifying: {
              states: {
                challenging: {}
                waiting: {}
                done: {}
              }
            }
          }
        }
        done: {}
      }
    }
    synchronizing: {
      states: {
        sendingUpdate: {}
        receivingUpdate: {}
        sendingMissingLinks: {}
        receivingMissingLinks: {}
        waiting: {}
        done: {}
      }
    }
    negotiating: {
      states: {
        sendingSeed: {
          states: {
            sending: {}
            done: {}
          }
        }
        receivingSeed: {
          states: {
            waiting: {}
            done: {}
          }
        }
      }
    }
    connected: {}
    failure: {}
  }
}
