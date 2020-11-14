import { ActionFunction, ConditionPredicate } from 'xstate'
import { Device } from '/device'
import { Challenge } from '/identity'
import { ProofOfInvitation } from '/invitation'
import { KeyScope } from '/keyset'
import { Member } from '/member'
import { ConnectionMessage } from '/message'
import { Team } from '/team'
import { User } from '/user'
import { Base64 } from '/util'

export type SendFunction = (message: ConnectionMessage) => void

export interface ConnectionStateSchema {
  states: {
    disconnected: {}
    awaitingInvitationAcceptance: {}
    validatingInvitationProof: {}
    authenticating: {
      states: {
        claimingIdentity: {
          states: {
            awaitingIdentityChallenge: {}
            awaitingIdentityAcceptance: {}
            success: {}
          }
        }
        verifyingIdentity: {
          states: {
            challengingIdentityClaim: {}
            awaitingIdentityProof: {}
            failure: {}
            success: {}
          }
        }
      }
    }
    failure: {}
    connected: {}
  }
}

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
  encryptedPeerSeed?: Base64
  secretKey?: Base64
}

export type Action = ActionFunction<ConnectionContext, ConnectionMessage>
export type Condition = ConditionPredicate<ConnectionContext, ConnectionMessage>
