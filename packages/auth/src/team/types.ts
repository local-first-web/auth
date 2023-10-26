import {
  type Base58,
  type Graph,
  type Hash,
  type KeyMetadata,
  type Keyring,
  type Keyset,
  type KeysetWithSecrets,
  type Link,
  type LinkBody,
  type Payload,
  type ROOT,
  type Sequence,
} from '@localfirst/crdx'
import { type Client, type LocalContext } from 'context/index.js'
import { type Device } from 'device/index.js'
import { type Invitation, type InvitationState } from 'invitation/types.js'
import { type Lockbox } from 'lockbox/index.js'
import { type PermissionsMap, type Role } from 'role/index.js'
import { type Host, type Server } from 'server/index.js'
import { type ValidationResult } from 'util/index.js'

// ********* MEMBER

/** A member is a user that belongs to a team. */
export type Member = {
  // TODO enforce uniqueness
  /** Unique ID populated on creation. */
  userId: string

  // TODO enforce uniqueness
  /** Username (or email). Must be unique but is not used for lookups. Only provided to connect
   * human identities with other systems. */
  userName?: string

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
export type NewTeamOptions = {
  /** The team's human-facing name */
  teamName: string

  /** The team keys need to be provided for encryption and decryption. It's up to the application to persist these somewhere.  */
  teamKeys: KeysetWithSecrets
}

/** Properties required when rehydrating from an existing graph  */
export type ExistingTeamOptions = {
  /** The `TeamGraph` representing the team's state, to be rehydrated.
   *  Can be serialized or not. */
  source: string | TeamGraph

  /** The team keys need to be provided for encryption and decryption. It's up to the application to persist these somewhere.  */
  teamKeyring: Keyring
}

type NewOrExisting = NewTeamOptions | ExistingTeamOptions

/** Options passed to the `Team` constructor */
export type TeamOptions = NewOrExisting & {
  /** A seed for generating keys. This is typically only used for testing, to ensure predictable data. */
  seed?: string

  /** Object containing the current user and device (and optionally information about the client & version). */
  context: LocalContext
}

/** Type guard for NewTeamOptions vs ExistingTeamOptions  */
export const isNewTeam = (options: NewOrExisting): options is NewTeamOptions =>
  'teamName' in options

// ********* ACTIONS

// TODO: the content of lockboxes needs to be validated
// e.g. only an admin can add lockboxes for others

type BasePayload = {
  // Every action might include new lockboxes
  lockboxes?: Lockbox[]
}

export type RootAction = {
  type: typeof ROOT
  payload: BasePayload & {
    name: string
    rootMember: Member
    rootDevice: Device
  }
}

export type AddMemberAction = {
  type: 'ADD_MEMBER'
  payload: BasePayload & {
    member: Member
    roles?: string[]
  }
}

export type RemoveMemberAction = {
  type: 'REMOVE_MEMBER'
  payload: BasePayload & {
    userId: string
  }
}

export type AddRoleAction = {
  type: 'ADD_ROLE'
  payload: BasePayload & Role
}

export type RemoveRoleAction = {
  type: 'REMOVE_ROLE'
  payload: BasePayload & {
    roleName: string
  }
}

export type AddMemberRoleAction = {
  type: 'ADD_MEMBER_ROLE'
  payload: BasePayload & {
    userId: string
    roleName: string
    permissions?: PermissionsMap
  }
}

export type RemoveMemberRoleAction = {
  type: 'REMOVE_MEMBER_ROLE'
  payload: BasePayload & {
    userId: string
    roleName: string
  }
}

export type AddDeviceAction = {
  type: 'ADD_DEVICE'
  payload: BasePayload & {
    device: Device
  }
}

export type RemoveDeviceAction = {
  type: 'REMOVE_DEVICE'
  payload: BasePayload & {
    userId: string
    deviceName: string
  }
}

export type InviteMemberAction = {
  type: 'INVITE_MEMBER'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export type InviteDeviceAction = {
  type: 'INVITE_DEVICE'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export type RevokeInvitationAction = {
  type: 'REVOKE_INVITATION'
  payload: BasePayload & {
    id: string // Invitation ID
  }
}

export type AdmitMemberAction = {
  type: 'ADMIT_MEMBER'
  payload: BasePayload & {
    id: Base58 // Invitation ID
    userName: string
    memberKeys: Keyset // Member keys provided by the new member
  }
}

export type AdmitDeviceAction = {
  type: 'ADMIT_DEVICE'
  payload: BasePayload & {
    id: Base58 // Invitation ID
    userId: string // User name of the device's owner
    deviceName: string // Name given to the device by the owner
    deviceKeys: Keyset // Device keys provided by the new device
  }
}

export type ChangeMemberKeysAction = {
  type: 'CHANGE_MEMBER_KEYS'
  payload: BasePayload & {
    keys: Keyset
  }
}

export type ChangeDeviceKeysAction = {
  type: 'CHANGE_DEVICE_KEYS'
  payload: BasePayload & {
    keys: Keyset
  }
}

export type RotateKeysAction = {
  type: 'ROTATE_KEYS'
  payload: BasePayload & {
    userId: string
  }
}

export type AddServerAction = {
  type: 'ADD_SERVER'
  payload: BasePayload & {
    server: Server
  }
}

export type RemoveServerAction = {
  type: 'REMOVE_SERVER'
  payload: BasePayload & {
    host: Host
  }
}

export type ChangeServerKeysAction = {
  type: 'CHANGE_SERVER_KEYS'
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
  | RotateKeysAction
  | AddServerAction
  | RemoveServerAction
  | ChangeServerKeysAction

export type TeamContext = {
  deviceId: string
  client?: Client
}

export type TeamLinkBody = LinkBody<TeamAction, TeamContext>

export type TeamLink = Link<TeamAction, TeamContext> & {
  isInvalid?: boolean
}

export type TeamLinkMap = Record<Hash, TeamLink>
export type TeamGraph = Graph<TeamAction, TeamContext>
export type Branch = Sequence<TeamAction, TeamContext>
export type TwoBranches = [Branch, Branch]
export type MembershipRuleEnforcer = (links: TeamLink[], graph: TeamGraph) => TeamLink[]

// ********* TEAM STATE

export type TeamState = {
  head: Hash[]

  teamName: string
  rootContext?: TeamContext
  members: Member[]
  roles: Role[]
  servers: Server[]
  lockboxes: Lockbox[]
  invitations: InvitationMap

  // We keep track of removed members and devices primarily so that we deliver the correct message
  // to them when we refuse to connect
  removedMembers: Member[]
  removedDevices: Device[]
  removedServers: Server[]

  // If a member's admission is reversed, we need to flag them as compromised so an admin can
  // rotate any keys they had access to at the first opportunity
  pendingKeyRotations: string[]
}

export type InvitationMap = Record<string, InvitationState>

// ********* VALIDATION

export type TeamStateValidator = (previousState: TeamState, link: TeamLink) => ValidationResult

export type TeamStateValidatorSet = Record<string, TeamStateValidator>

export type ValidationArgs = [TeamState, TeamLink]

// ********* CRYPTO

export type EncryptedEnvelope = {
  contents: Base58
  recipient: KeyMetadata
}

export type SignedEnvelope = {
  contents: Payload
  signature: Base58
  author: KeyMetadata
}

export type Transform = (state: TeamState) => TeamState
