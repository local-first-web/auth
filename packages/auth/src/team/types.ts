import { Client, LocalUserContext } from '@/context'
import { Device } from '@/device'
import { Invitation, InvitationState } from '@/invitation/types'
import { Lockbox } from '@/lockbox'
import { PermissionsMap, Role } from '@/role'
import { Base58, Payload, ValidationResult } from '@/util'
import {
  Action,
  KeyMetadata,
  Keyset,
  Link,
  LinkBody,
  LinkMap,
  ROOT,
  Sequence,
  SignatureChain,
} from 'crdx'

// ********* MEMBER

/** A member is a user that belongs to a team. */
export interface Member {
  userName: string

  /** The member's public keys */
  keys: Keyset

  /** Array of role names that the member belongs to */
  roles: string[]

  /** Devices that the member has added, along with their public */
  devices?: Device[]

  // TODO: are we using this?
  /** Array of all the public keys that the member has had, including the current ones */
  keyHistory?: Keyset[]
}

// ********* TEAM CONSTRUCTOR

/** Properties required when creating a new team */
export interface NewTeamOptions {
  /** The team's human-facing name */
  teamName: string
}

/** Properties required when rehydrating from an existing chain  */
export interface ExistingTeamOptions {
  /** The `TeamSignatureChain` representing the team's state, to be rehydrated.
   *  Can be serialized or not. */
  source: string | TeamSignatureChain
}

type NewOrExisting = NewTeamOptions | ExistingTeamOptions

/** Options passed to the `Team` constructor */
export type TeamOptions = NewOrExisting & {
  /** A seed for generating keys. This is typically only used for testing, to ensure predictable data. */
  seed?: string

  /** Object containing the current user and device (and optionally information about the client & version) */
  context: LocalUserContext
}

/** type guard for NewTeamOptions vs ExistingTeamOptions  */
export const isNewTeam = (options: NewOrExisting): options is NewTeamOptions =>
  'teamName' in options

// ********* ACTIONS

// TODO: the content of lockboxes needs to be validated
// e.g. only an admin can add lockboxes for others

interface BasePayload {
  // Every action might include new lockboxes
  lockboxes?: Lockbox[]
}

export interface RootAction {
  type: typeof ROOT
  payload: BasePayload & {
    name: string
    rootMember: Member
    rootDevice: Device
  }
}

export interface AddMemberAction {
  type: 'ADD_MEMBER'
  payload: BasePayload & {
    member: Member
    roles?: string[]
  }
}

export interface RemoveMemberAction {
  type: 'REMOVE_MEMBER'
  payload: BasePayload & {
    userName: string
  }
}

export interface AddRoleAction {
  type: 'ADD_ROLE'
  payload: BasePayload & Role
}

export interface RemoveRoleAction {
  type: 'REMOVE_ROLE'
  payload: BasePayload & {
    roleName: string
  }
}

export interface AddMemberRoleAction {
  type: 'ADD_MEMBER_ROLE'
  payload: BasePayload & {
    userName: string
    roleName: string
    permissions?: PermissionsMap
  }
}

export interface RemoveMemberRoleAction {
  type: 'REMOVE_MEMBER_ROLE'
  payload: BasePayload & {
    userName: string
    roleName: string
  }
}

export interface AddDeviceAction {
  type: 'ADD_DEVICE'
  payload: BasePayload & {
    device: Device
  }
}

export interface RemoveDeviceAction {
  type: 'REMOVE_DEVICE'
  payload: BasePayload & {
    userName: string
    deviceName: string
  }
}

export interface InviteMemberAction {
  type: 'INVITE_MEMBER'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export interface InviteDeviceAction {
  type: 'INVITE_DEVICE'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export interface RevokeInvitationAction {
  type: 'REVOKE_INVITATION'
  payload: BasePayload & {
    id: string // invitation ID
  }
}

export interface AdmitMemberAction {
  type: 'ADMIT_MEMBER'
  payload: BasePayload & {
    id: string // invitation ID
    memberKeys: Keyset // member keys provided by the new member
  }
}

export interface AdmitDeviceAction {
  type: 'ADMIT_DEVICE'
  payload: BasePayload & {
    id: string // invitation ID
    userName: string // user name of the device's owner
    deviceKeys: Keyset // device keys provided by the new device
  }
}

export interface ChangeMemberKeysAction {
  type: 'CHANGE_MEMBER_KEYS'
  payload: BasePayload & {
    keys: Keyset
  }
}

export interface ChangeDeviceKeysAction {
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
export type TeamLinkMap = LinkMap<TeamAction, TeamContext>
export type TeamSignatureChain = SignatureChain<TeamAction, TeamContext>
export type Branch = Sequence<TeamAction, TeamContext>
export type TwoBranches = [Branch, Branch]
export type MembershipRuleEnforcer = (links: TeamLink[], chain: TeamSignatureChain) => TeamLink[]

// ********* TEAM STATE

export interface TeamState {
  teamName: string
  rootContext?: TeamContext
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

// ********* VALIDATION

export type TeamStateValidator = (prevState: TeamState, link: TeamLink) => ValidationResult

export type TeamStateValidatorSet = {
  [key: string]: TeamStateValidator
}

export type ValidationArgs = [TeamState, TeamLink]

// ********* CRYPTO

export interface EncryptedEnvelope {
  contents: Base58
  recipient: KeyMetadata
}

export interface SignedEnvelope {
  contents: Payload
  signature: Base58
  author: KeyMetadata
}

export type Transform = (state: TeamState) => TeamState
