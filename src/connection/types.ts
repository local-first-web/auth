import { ActionFunction, AssignAction, ConditionPredicate } from 'xstate'
import { ConnectionMessage, NumberedConnectionMessage } from './message'
import { Device } from '/device'
import { Challenge } from '/identity'
import { ProofOfInvitation } from '/invitation'
import { KeyScope } from '/keyset'
import { Member } from '/member'
import { Team } from '/team'
import { User } from '/user'
import { Base64, Hash } from '/util'

export type SendFunction = <T extends ConnectionMessage>(message: T) => void

// Context schema

export type InitialContext = {
  /** The local user, including their secret keys */
  user: User
  /** The local device, including secret keys */
  device: Device
  /** If we already belong to the team, we pass the team object we both belong to */
  team?: Team
  /** If we've just been invited, we provide the invitation secret key that we've been given  */
  invitationSecretKey?: string
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
  seed?: Base64
  theirEncryptedSeed?: Base64
  sessionKey?: Base64
  error?: {
    message: string
    details?: any
  }
  theirHead?: Hash
}

export type Action =
  | ActionFunction<ConnectionContext, ConnectionMessage>
  | AssignAction<ConnectionContext, ConnectionMessage>
export type Condition = ConditionPredicate<ConnectionContext, ConnectionMessage>

// State schema

export interface ConnectionStateSchema {
  states: {
    disconnected: {}
    initializing: {}
    awaitingInvitationAcceptance: {}
    validatingInvitationProof: {}
    authenticating: {
      states: {
        claimingIdentity: {
          states: {
            awaitingIdentityChallenge: {}
            awaitingIdentityAcceptance: {}
            done: {}
          }
        }
        verifyingIdentity: {
          states: {
            challengingIdentityClaim: {}
            awaitingIdentityProof: {}
            done: {}
          }
        }
      }
    }
    updating: {
      states: {
        sendingUpdate: {}
        receivingUpdate: {}
        sendingMissingLinks: {}
        receivingMissingLinks: {}
        waiting: {}
        done: {}
      }
    }
    connected: {}
    failure: {}
  }
}
