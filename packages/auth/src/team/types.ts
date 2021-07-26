import { Client, LocalDeviceContext, LocalUserContext, MemberContext } from '@/context'
import { PublicDevice } from '@/device'
import { Invitation, InvitationState } from '@/invitation/types'
import {
  Action,
  ActionLink,
  KeyMetadata,
  Keyset,
  Link,
  LinkBody,
  LinkMap,
  NonMergeLink,
  ROOT,
  Sequence,
  SignatureChain,
} from 'crdx'
import { Lockbox } from '@/lockbox'
import { PermissionsMap, Role } from '@/role'
import { Base58, Payload, ValidationResult } from '@/util'

export interface Member {
  userName: string
  keys: Keyset
  roles: string[]
  devices?: PublicDevice[]
  keyHistory?: Keyset[]
}

// TEAM CONSTRUCTOR

// only when creating a new team
export interface NewTeamOptions {
  /** The team's human-facing name */
  teamName: string

  /** The context of the local user */
  context: LocalUserContext
}

// only when rehydrating from a chain
export interface ExistingTeamOptions {
  /** The `TeamSignatureChain` representing the team's state. Can be serialized or not. */
  source: string | TeamSignatureChain

  /** The context of the local user */
  context: LocalDeviceContext
}

export type TeamOptions = (NewTeamOptions | ExistingTeamOptions) & {
  /** A seed for generating keys. This is typically only used for testing, to ensure predictable data. */
  seed?: string
}

/** type guard for NewTeamOptions vs ExistingTeamOptions  */
export const isNewTeam = (
  options: NewTeamOptions | ExistingTeamOptions
): options is NewTeamOptions => 'teamName' in options

// TODO: the content of lockboxes needs to be validated
// e.g. only an admin can add lockboxes for others

interface BasePayload {
  // Every action might include new lockboxes
  lockboxes?: Lockbox[]
}

export interface RootAction extends Action {
  type: typeof ROOT
  payload: BasePayload & {
    name: string
    rootMember: Member
    rootDevice: PublicDevice
  }
}

export interface AddMemberAction extends Action {
  type: 'ADD_MEMBER'
  payload: BasePayload & {
    member: Member
    roles?: string[]
  }
}

export interface RemoveMemberAction extends Action {
  type: 'REMOVE_MEMBER'
  payload: BasePayload & {
    userName: string
  }
}

export interface AddRoleAction extends Action {
  type: 'ADD_ROLE'
  payload: BasePayload & Role
}

export interface RemoveRoleAction extends Action {
  type: 'REMOVE_ROLE'
  payload: BasePayload & {
    roleName: string
  }
}

export interface AddMemberRoleAction extends Action {
  type: 'ADD_MEMBER_ROLE'
  payload: BasePayload & {
    userName: string
    roleName: string
    permissions?: PermissionsMap
  }
}

export interface RemoveMemberRoleAction extends Action {
  type: 'REMOVE_MEMBER_ROLE'
  payload: BasePayload & {
    userName: string
    roleName: string
  }
}

export interface AddDeviceAction extends Action {
  type: 'ADD_DEVICE'
  payload: BasePayload & {
    device: PublicDevice
  }
}

export interface RemoveDeviceAction extends Action {
  type: 'REMOVE_DEVICE'
  payload: BasePayload & {
    userName: string
    deviceName: string
  }
}

export interface InviteMemberAction extends Action {
  type: 'INVITE_MEMBER'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export interface InviteDeviceAction extends Action {
  type: 'INVITE_DEVICE'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export interface RevokeInvitationAction extends Action {
  type: 'REVOKE_INVITATION'
  payload: BasePayload & {
    id: string // invitation ID
  }
}

export interface AdmitMemberAction extends Action {
  type: 'ADMIT_MEMBER'
  payload: BasePayload & {
    id: string // invitation ID
    memberKeys: Keyset // member keys provided by the new member
  }
}

export interface AdmitDeviceAction extends Action {
  type: 'ADMIT_DEVICE'
  payload: BasePayload & {
    id: string // invitation ID
    userName: string // user name of the device's owner
    deviceKeys: Keyset // device keys provided by the new device
  }
}

export interface ChangeMemberKeysAction extends Action {
  type: 'CHANGE_MEMBER_KEYS'
  payload: BasePayload & {
    keys: Keyset
  }
}

export interface ChangeDeviceKeysAction extends Action {
  type: 'CHANGE_DEVICE_KEYS'
  payload: BasePayload & {
    keys: Keyset
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
  | InviteMemberAction
  | InviteDeviceAction
  | RevokeInvitationAction
  | AdmitMemberAction
  | AdmitDeviceAction
  | ChangeMemberKeysAction
  | ChangeDeviceKeysAction

export type TeamContext = {
  deviceId: string
  client?: Client
}

export type TeamLinkBody = LinkBody<TeamAction, TeamContext>
export type TeamLink = Link<TeamAction, TeamContext>
export type TeamActionLink = ActionLink<TeamAction, TeamContext>
export type TeamNonMergeLink = NonMergeLink<TeamAction, TeamContext>
export type TeamLinkMap = LinkMap<TeamAction, TeamContext>
export type TeamSignatureChain = SignatureChain<TeamAction, TeamContext>
export type Branch = Sequence<TeamAction, TeamContext>
export type TwoBranches = [Branch, Branch]
export type ActionFilter = (link: NonMergeLink<TeamAction, TeamContext>) => boolean
export type ActionFilterFactory = (branches: TwoBranches, chain: TeamSignatureChain) => ActionFilter

// TEAM STATE

export interface TeamState {
  teamName: string
  rootContext?: MemberContext
  members: Member[]
  roles: Role[]
  lockboxes: Lockbox[]
  invitations: InvitationMap
  removedMembers: string[]
  removedDevices: string[]
}

export interface TeamLockboxMap {
  [userName: string]: UserLockboxMap
}

export interface UserLockboxMap {
  [publicKey: string]: Lockbox[]
}

export interface InvitationMap {
  [id: string]: InvitationState
}

// VALIDATION

export type TeamStateValidator = (prevState: TeamState, link: TeamActionLink) => ValidationResult

export type TeamStateValidatorSet = {
  [key: string]: TeamStateValidator
}

export type ValidationArgs = [TeamState, TeamActionLink]

// CRYPTO

export interface EncryptedEnvelope {
  contents: Base58
  recipient: KeyMetadata
}

export interface SignedEnvelope {
  contents: Payload
  signature: Base58
  author: KeyMetadata
}
