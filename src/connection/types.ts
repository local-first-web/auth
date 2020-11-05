import { ActionFunction, ConditionPredicate } from 'xstate'
import { Device } from '/device'
import { Member } from '/member'
import { ChallengeIdentityMessage, ConnectionMessage } from '/message'
import { Team } from '/team'
import { User } from '/user'
import { Base64 } from '/util'

export type SendFunction = (message: ConnectionMessage) => void

// State schema: all the possible states

export interface ConnectionStateSchema {
  states: {
    disconnected: {}
    connecting: {
      states: {
        claimingIdentity: {
          states: {
            initializing: {}
            awaitingInvitationAcceptance: {}
            awaitingIdentityChallenge: {}
            awaitingIdentityAcceptance: {}
            success: {}
          }
        }
        verifyingIdentity: {
          states: {
            initializing: {}
            awaitingInvitationProof: {}
            awaitingIdentityClaim: {}
            awaitingIdentityProof: {}
            success: {}
          }
        }
      }
    }
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
  challenge?: ChallengeIdentityMessage
  peer?: Member
  seed?: Base64
  encryptedPeerSeed?: Base64
  secretKey?: Base64
}

// Typestates

// These define which context elements (from ConnectionContext) will or won't be present for specific states (from ConnectionStateSchema)
// http://xstate.js.org/docs/guides/typescript.html#typestates

// In these states, we don't know if we have an invitation or if we're a team member
export type DisconnectedConnectionState = {
  value:
    | { disconnected: {} }
    | {
        connecting:
          | { claimingIdentity: { initializing: {} } } //
          | { verifyingIdentity: 'initializing' }
      }
  context: ConnectionContext // can't specify anything further
}

// In these states, we have an invitation & we're not a team member, so we have an invitationSecretKey and no team instance
export type NonMemberConnectionState = {
  value: {
    connecting: { claimingIdentity: 'awaitingInvitationAcceptance' }
  }
  context: NonMemberConnectionContext
}

export type NonMemberConnectionContext = ConnectionContext & {
  team: undefined // we don't have a team instance
  invitationSecretKey: string // we do have an invitation
}

// In these states, we're a team member, so we have a team instance in context
export type MemberConnectionState = {
  value:
    | {
        connecting: {
          claimingIdentity:
            | { awaitingIdentityChallenge: {} } //
            | 'awaitingIdentityAcceptance'
            | 'success'
          verifyingIdentity:
            | 'awaitingInvitationProof'
            | 'awaitingIdentityClaim'
            | 'awaitingIdentityProof'
            | 'success'
        }
      }
    | 'connected'
  context: MemberConnectionContext
}

export type MemberConnectionContext = ConnectionContext & {
  team: Team // we have a team instance
}

export type ConnectionState =
  | DisconnectedConnectionState
  | NonMemberConnectionState
  | MemberConnectionState

export type Action = ActionFunction<ConnectionContext, ConnectionMessage>
export type Condition = ConditionPredicate<ConnectionContext, ConnectionMessage>
