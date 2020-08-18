import { Member } from '/member'
import {
  AcceptIdentityMessage,
  ChallengeIdentityMessage,
  ClaimIdentityMessage,
  ProveIdentityMessage,
  RejectIdentityMessage,
} from '/message'
import { Team } from '/team'
import { User } from '/user'
import { Base64 } from '/util'
import { ActionFunction, ConditionPredicate } from 'xstate'

export type SendFunction = (message: ConnectionEvent) => void

/** Parameters needed to instantiate a connection  */
export type ConnectionParams = {
  /** A function to send messages to our peer - this is how you hook this up to your network stack */
  sendMessage: SendFunction

  /** The team object that the peers presumably both belong to */
  team: Team

  /** The local user, including their secret keys */
  user: User
}

export interface ConnectionContext {
  team: Team
  user: User
  challenge?: ChallengeIdentityMessage
  peer?: Member
  seed?: Base64
  encryptedPeerSeed?: Base64
  secretKey?: Base64
}

export type ConnectionEvent =
  | { type: 'CONNECT' }
  | ClaimIdentityMessage
  | ChallengeIdentityMessage
  | ProveIdentityMessage
  | AcceptIdentityMessage
  | RejectIdentityMessage
  | { type: 'DISCONNECT' }

export type ConnectingState = {
  connecting: {
    claimingIdentity: 'awaitingChallenge' | 'awaitingAcceptance'
    verifyingIdentity: 'awaitingClaim' | 'awaitingProof'
  }
}

export type ConnectionState = {
  value: 'disconnected' | ConnectingState | 'connected'
  context: ConnectionContext
}

export interface ConnectionStateSchema {
  states: {
    disconnected: {}
    connecting: {
      states: {
        claimingIdentity: {
          states: {
            awaitingChallenge: {}
            awaitingAcceptance: {}
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

export type Action = ActionFunction<ConnectionContext, ConnectionEvent>
export type Condition = ConditionPredicate<ConnectionContext, ConnectionEvent>
