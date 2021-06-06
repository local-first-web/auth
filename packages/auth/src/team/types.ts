import { TeamActionLink, TeamSignatureChain } from '@/chain'
import { LocalDeviceContext, LocalUserContext, MemberContext } from '@/context'
import { Invitation, InvitationState } from '@/invitation/types'
import { KeyMetadata } from '@/keyset'
import { Lockbox } from '@/lockbox'
import { Member } from '@/member'
import { Role } from '@/role'
import { Base64, Payload, ValidationResult } from '@/util'

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
  contents: Base64
  recipient: KeyMetadata
}

export interface SignedEnvelope {
  contents: Payload
  signature: Base64
  author: KeyMetadata
}
