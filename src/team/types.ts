import { Base64 } from 'lib'
import { User } from 'user'
import {
  baseLinkType,
  SignatureChain,
  SignedLink,
  ValidationResult,
} from '../chain'
import { ContextWithSecrets, Device } from '../context'
import { PublicKeyset } from '../keys'
import { PermissionsMap, Role } from '../role'
import { TeamState } from './teamState'

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
export function includesSource(
  options: TeamOptions
): options is ExistingTeamOptions {
  return (options as ExistingTeamOptions).source !== undefined
}

// LINK TYPES

export type TeamLink =
  | {
      type: 'ROOT'
      payload: {
        teamName: string
        publicKeys: PublicKeyset
        foundingMember: User
      }
    }
  | {
      type: 'ADD_MEMBER'
      payload: {
        user: User
        roles?: string[]
      }
    }
  | {
      type: 'ADD_DEVICE'
      payload: {
        userName: string
      }
    }
  | {
      type: 'ADD_ROLE'
      payload: Role
    }
  | {
      type: 'ADD_MEMBER_ROLE'
      payload: {
        userName: string
        roleName: string
        permissions?: PermissionsMap
      }
    }
  | {
      type: 'REVOKE_MEMBER'
      payload: {
        userName: string
      }
    }
  | {
      type: 'REVOKE_DEVICE'
      payload: {
        userName: string
        deviceId: string
      }
    }
  | {
      type: 'REVOKE_ROLE'
      payload: {
        roleName: string
      }
    }
  | {
      type: 'REVOKE_MEMBER_ROLE'
      payload: {
        userName: string
        roleName: string
      }
    }
  | {
      type: 'INVITE'
      payload: {}
    }
  | {
      type: 'ACCEPT'
      payload: {}
    }
  | {
      type: 'ROTATE_KEYS'
      payload: {
        oldPublicKey: Base64
        newPublicKey: Base64
      }
    }

// VALIDATION

export type TeamStateValidator = (
  prevState: TeamState,
  link: SignedLink
) => ValidationResult

export type TeamStateValidatorSet = {
  [key: string]: TeamStateValidator
}

export type ValidationArgs = [TeamState, SignedLink]
