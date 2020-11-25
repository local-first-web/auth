import {
  Action,
  ActionLink,
  Link,
  LinkBody,
  LinkMap,
  NonRootLink,
  ROOT,
  SignatureChain,
} from '/chain'
import { LocalUserContext, MemberContext } from '/context'
import { Device } from '/device'
import { Invitation } from '/invitation/types'
import { KeyMetadata } from '/keyset'
import { Lockbox } from '/lockbox'
import { Member } from '/member'
import { PermissionsMap, Role } from '/role'
import { Base64, Payload, ValidationResult } from '/util'

// TEAM CONSTRUCTOR

export interface NewTeamOptions {
  teamName: string
  context: LocalUserContext
}

export interface ExistingTeamOptions {
  source: string | TeamSignatureChain
  context: LocalUserContext
}

export type TeamOptions = NewTeamOptions | ExistingTeamOptions

// type guard for NewTeamOptions vs ExistingTeamOptions
export function isNewTeam(options: TeamOptions): options is NewTeamOptions {
  return (options as ExistingTeamOptions).source === undefined
}

// TEAM STATE

export interface TeamState {
  teamName: string
  rootContext?: MemberContext
  members: Member[]
  roles: Role[]
  lockboxes: Lockbox[]
  invitations: InvitationMap
}

export interface TeamLockboxMap {
  [userName: string]: UserLockboxMap
}

export interface UserLockboxMap {
  [publicKey: string]: Lockbox[]
}

export interface InvitationMap {
  [id: string]: Invitation
}

// LINK TYPES

// Every action might include new lockboxes
interface BasePayload {
  lockboxes?: Lockbox[]
}

export interface RootAction extends Action {
  type: typeof ROOT
  payload: BasePayload & {
    teamName: string
    rootMember: Member
  }
}

export interface AddMemberAction extends Action {
  type: 'ADD_MEMBER'
  payload: BasePayload & {
    member: Member
    roles?: string[]
  }
}

export interface AddDeviceAction extends Action {
  type: 'ADD_DEVICE'
  payload: BasePayload & {
    device: Device
  }
}

export interface AddRoleAction extends Action {
  type: 'ADD_ROLE'
  payload: BasePayload & Role
}

export interface AddMemberRoleAction extends Action {
  type: 'ADD_MEMBER_ROLE'
  payload: BasePayload & {
    userName: string
    roleName: string
    permissions?: PermissionsMap
  }
}

export interface RemoveMemberAction extends Action {
  type: 'REMOVE_MEMBER'
  payload: BasePayload & {
    userName: string
  }
}

export interface RemoveDeviceAction extends Action {
  type: 'REMOVE_DEVICE'
  payload: BasePayload & {
    userName: string
    deviceId: string
  }
}

export interface RemoveRoleAction extends Action {
  type: 'REMOVE_ROLE'
  payload: BasePayload & {
    roleName: string
  }
}

export interface RemoveMemberRoleAction extends Action {
  type: 'REMOVE_MEMBER_ROLE'
  payload: BasePayload & {
    userName: string
    roleName: string
  }
}

export interface PostInvitationAction extends Action {
  type: 'POST_INVITATION'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export interface RevokeInvitationAction extends Action {
  type: 'REVOKE_INVITATION'
  payload: BasePayload & {
    id: string
  }
}

export interface AdmitInvitedMemberAction extends Action {
  type: 'ADMIT_INVITED_MEMBER'
  payload: BasePayload & {
    id: string
    member: Member
    roles?: string[]
  }
}

export interface AdmitInvitedDeviceAction extends Action {
  type: 'ADMIT_INVITED_DEVICE'
  payload: BasePayload & {
    id: string
    device: Device
  }
}

export type TeamAction =
  | RootAction
  | AddMemberAction
  | AddDeviceAction
  | AddRoleAction
  | AddMemberRoleAction
  | RemoveMemberAction
  | RemoveDeviceAction
  | RemoveRoleAction
  | RemoveMemberRoleAction
  | PostInvitationAction
  | RevokeInvitationAction
  | AdmitInvitedMemberAction
  | AdmitInvitedDeviceAction

export type TeamLinkBody = LinkBody<TeamAction>
export type TeamLink = Link<TeamAction>
export type TeamNonRootLink = NonRootLink<TeamAction>
export type TeamActionLink = ActionLink<TeamAction>
export type TeamLinkMap = LinkMap<TeamAction>
export type TeamSignatureChain = SignatureChain<TeamAction>

// VALIDATION

export type TeamStateValidator = (prevState: TeamState, link: TeamActionLink) => ValidationResult

export type TeamStateValidatorSet = {
  [key: string]: TeamStateValidator
}

export type ValidationArgs = [TeamState, TeamActionLink]

// CRYPTO

export interface EncryptedEnvelope {
  contents: Base64
  recipient: KeyMetadata
}

export interface SignedEnvelope {
  contents: Payload
  signature: Base64
  author: KeyMetadata
}
