import { User } from 'user'
import { baseLinkType, SignatureChain } from '../chain'
import { Context, ContextWithSecrets } from '../context'
import { PublicKeyset } from '../keys'

export interface TeamState {
  name: string
  rootContext?: Context
  members: Member[]
  roles: string[]
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

export interface Member {
  name: string
  keys: PublicKeyset
  roles?: string[]
}

// link types & corresponding payload types

export const linkType = {
  ...baseLinkType,
  INVITE: 'INVITE',
  ADD_MEMBER: 'ADD_MEMBER',
  ADD_DEVICE: 'ADD_DEVICE',
  ADD_ROLE: 'ADD_ROLE',
  ADD_MEMBER_ROLE: 'ADD_MEMBER_ROLE',
  REVOKE_MEMBER: 'REVOKE_MEMBER',
  REVOKE_DEVICE: 'REVOKE_DEVICE',
  REVOKE_ROLE: 'REVOKE_ROLE',
  REVOKE_MEMBER_ROLE: 'REVOKE_MEMBER_ROLE',
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
