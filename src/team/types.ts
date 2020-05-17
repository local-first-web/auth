import { LinkBody, SignatureChain, SignedLink, ValidationResult } from '/chain'
import { Context, ContextWithSecrets } from '/context'
import { KeysetWithSecrets } from '/keys'
import { Base64 } from '/lib'
import { Lockbox } from '/lockbox'
import { Member } from '/member'
import { PermissionsMap, Role } from '/role'
import { User } from '/user'

// TEAM CONSTRUCTOR

export interface NewTeamOptions {
  teamName: string
  context: ContextWithSecrets
}

export interface OldTeamOptions {
  source: SignatureChain<TeamLink>
  context: ContextWithSecrets
}

export type TeamOptions = NewTeamOptions | OldTeamOptions

// type guard for NewTeamOptions vs OldTeamOptions
export function isNew(options: TeamOptions): options is NewTeamOptions {
  return (options as OldTeamOptions).source === undefined
}

// TEAM STATE

export interface TeamState {
  teamName: string
  rootContext?: Context
  members: Member[]
  roles: Role[]
  lockboxes: TeamLockboxMap
}

export interface TeamLockboxMap {
  [userName: string]: UserLockboxMap
}

export interface UserLockboxMap {
  [publicKey: string]: Lockbox[]
}

export interface KeysetMap {
  [scope: string]: KeysetWithSecrets
}

// LINK TYPES

interface BasePayload {
  // TODO: once this is implemented everywhere it should not be optional - every action will create
  // new lockboxes or affect existing ones
  lockboxes?: Lockbox[]
}

export type TeamAction =
  | {
      type: 'ROOT'
      payload: BasePayload & {
        teamName: string
        foundingMember: User
      }
    }
  | {
      type: 'ADD_MEMBER'
      payload: BasePayload & {
        user: User
        roles?: string[]
      }
    }
  | {
      type: 'ADD_DEVICE'
      payload: BasePayload & {
        userName: string
      }
    }
  | {
      type: 'ADD_ROLE'
      payload: BasePayload & Role
    }
  | {
      type: 'ADD_MEMBER_ROLE'
      payload: BasePayload & {
        userName: string
        roleName: string
        permissions?: PermissionsMap
      }
    }
  | {
      type: 'REVOKE_MEMBER'
      payload: BasePayload & {
        userName: string
      }
    }
  | {
      type: 'REVOKE_DEVICE'
      payload: BasePayload & {
        userName: string
        deviceId: string
      }
    }
  | {
      type: 'REVOKE_ROLE'
      payload: BasePayload & {
        roleName: string
      }
    }
  | {
      type: 'REVOKE_MEMBER_ROLE'
      payload: BasePayload & {
        userName: string
        roleName: string
      }
    }
  | {
      type: 'INVITE'
      payload: BasePayload & {}
    }
  | {
      type: 'ACCEPT'
      payload: BasePayload & {}
    }
  | {
      type: 'ROTATE_KEYS'
      payload: BasePayload & {
        oldPublicKey: Base64
        newPublicKey: Base64
      }
    }

export type TeamLinkBody = LinkBody & TeamAction
export type TeamLink = SignedLink<TeamLinkBody>

// VALIDATION

export type TeamStateValidator = (prevState: TeamState, link: SignedLink<TeamLinkBody>) => ValidationResult

export type TeamStateValidatorSet = {
  [key: string]: TeamStateValidator
}

export type ValidationArgs = [TeamState, SignedLink<TeamLinkBody>]
