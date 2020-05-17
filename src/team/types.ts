import { TeamState } from '/team/teamState'
import { LinkBody, SignatureChain, SignedLink, ValidationResult } from '/chain'
import { ContextWithSecrets } from '/context'
import { PublicKeyset } from '/keys'
import { Base64 } from '/lib'
import { PermissionsMap, Role } from '/role'
import { User } from '/user'

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

// LINK TYPES

export type TeamAction =
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

export type TeamLinkBody = LinkBody & TeamAction
export type TeamLink = SignedLink<TeamLinkBody>

// VALIDATION

export type TeamStateValidator = (
  prevState: TeamState,
  link: SignedLink<TeamLinkBody>
) => ValidationResult

export type TeamStateValidatorSet = {
  [key: string]: TeamStateValidator
}

export type ValidationArgs = [TeamState, SignedLink<TeamLinkBody>]
