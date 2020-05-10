import { User } from 'user'
import { baseLinkType, SignatureChain } from '../chain'
import { Context, ContextWithSecrets, Device } from '../context'
import { PublicKeyset } from '../keys'
import { Member } from '../member'
import { Role, PermissionsMap } from '../role'
import { Base64 } from 'lib'

export interface TeamState {
  teamName: string
  rootContext?: Context
  members: Member[]
  roles: Role[]
}

export interface NewTeamOptions {
  teamName: string
  context: ContextWithSecrets
}

export interface ExistingTeamOptions {
  source: SignatureChain
  context: ContextWithSecrets
}

export type TeamOptions = NewTeamOptions | ExistingTeamOptions

// type guard for NewTeamOptions vs ExistingTeam Options
export function exists(options: TeamOptions): options is ExistingTeamOptions {
  return (options as ExistingTeamOptions).source !== undefined
}

// link types & corresponding payload types

export const linkType = {
  ...baseLinkType,
  ADD_MEMBER: 'ADD_MEMBER',
  ADD_DEVICE: 'ADD_DEVICE',
  ADD_ROLE: 'ADD_ROLE',
  ADD_MEMBER_ROLE: 'ADD_MEMBER_ROLE',
  REVOKE_MEMBER: 'REVOKE_MEMBER',
  REVOKE_DEVICE: 'REVOKE_DEVICE',
  REVOKE_ROLE: 'REVOKE_ROLE',
  REVOKE_MEMBER_ROLE: 'REVOKE_MEMBER_ROLE',
  INVITE: 'INVITE',
  ACCEPT: 'ACCEPT',
  ROTATE_KEYS: 'ROTATE_KEYS',
}

export interface RootPayload {
  teamName: string
  publicKeys: PublicKeyset
  foundingMember: User
}

export interface AddMemberPayload {
  user: User
  roles?: string[]
}

export interface RevokeMemberPayload {
  userName: string
}

export interface AddDevicePayload {
  userName: string
  device: Device
}

export interface AddRolePayload {
  roleName: string
  permissions: PermissionsMap
}

export interface AddMemberRolePayload {
  userName: string
  roleName: string
}

export interface RevokeDevicePayload {
  userName: string
  deviceId: string
}

export interface RevokeRolePayload {
  roleName: string
}

export interface RevokeMemberRolePayload {
  userName: string
  roleName: string
}

export interface RotateKeysPayload {
  oldPublicKey: Base64
  newPublicKey: Base64
}
