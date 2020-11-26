import { TeamActionLink, TeamSignatureChain } from '/chain'
import { LocalUserContext, MemberContext } from '/context'
import { Invitation } from '/invitation/types'
import { KeyMetadata } from '/keyset'
import { Lockbox } from '/lockbox'
import { Member } from '/member'
import { Role } from '/role'
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
