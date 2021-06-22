import { MemberContext } from '@/context'
import { PublicDevice } from '@/device'
import { Invitation } from '@/invitation'
import { PublicKeyset } from '@/keyset'
import { Lockbox } from '@/lockbox'
import { Member } from '@/member'
import { PermissionsMap, Role } from '@/role'
import { Base64, Hash, UnixTimestamp, ValidationResult } from '@/util/types'

export const ROOT = 'ROOT'
export const MERGE = 'MERGE'

export interface Action {
  /** Label identifying the type of action this link represents */
  type: unknown

  /** Payload of the action */
  payload: unknown
}

export type NonRootLinkBody<A extends Action> = A & {
  /** Hash of the previous link*/
  prev: Hash

  /** Context in which this link was authored (user, device, client) */
  context: MemberContext

  /** Unix timestamp on device that created this link */
  timestamp: UnixTimestamp
}

export type RootLinkBody<A extends Action> = Omit<NonRootLinkBody<A>, 'prev'> & {
  type: typeof ROOT

  /** The root link is not linked to a previous link */
  prev: null
}

/** The part of the link that is signed */
export type LinkBody<A extends Action> = RootLinkBody<A> | NonRootLinkBody<A>

/** The full link, consisting of a body and a signature link */
export type SignedLink<B extends LinkBody<A>, A extends Action> = {
  /** Hash of this link */
  hash: Hash

  /** The part of the link that is signed & hashed */
  body: B

  /** The signature block (signature, name, and key) */
  signed: {
    /** NaCL-generated base64 signature of the link's body */
    signature: Base64

    /** The username (or ID or email) of the person signing the link */
    userName: string

    /** The name of the device in use when signing the link */
    deviceName: string

    /** The public half of the key used to sign the link, in base64 encoding */
    key: Base64
  }
}

export type MergeLink = {
  type: typeof MERGE

  /** Hash of this link */
  hash: Hash

  /** Hashes of the two concurrent heads being merged */
  body: Hash[]
}

export type RootLink<A extends Action> = SignedLink<RootLinkBody<A>, A>
export type NonRootLink<A extends Action> = SignedLink<NonRootLinkBody<A>, A>

export type ActionLink<A extends Action> = NonRootLink<A> | RootLink<A> // excludes MergeLink

export type Link<A extends Action> = ActionLink<A> | MergeLink

export type LinkMap<A extends Action> = Record<Hash, Link<A>>

export interface SignatureChain<A extends Action> {
  root: Hash
  head: Hash
  links: LinkMap<A>
}

// type guards

export const isMergeLink = (o: Link<any>): o is MergeLink => {
  return o && 'type' in o && o.type === MERGE
}

export const isRootLink = <A extends Action>(o: Link<A>): o is RootLink<A> => {
  return !isMergeLink(o) && o.body.prev === null
}

export type Sequence<A extends Action> = ActionLink<A>[]

/**
 * A resolver takes two heads and the chain they're in, and returns a single sequence combining the
 * two while applying any logic regarding which links to discard in case of conflict.
 */
export type Resolver<A extends Action = Action> = (
  branches: [Link<A>, Link<A>],
  chain: SignatureChain<A>
) => [Sequence<A>, Sequence<A>]

/**
 * A sequencer takes two sequences, and returns a single sequence combining the two
 * while applying any logic regarding which links take precedence.
 */
export type Sequencer<A extends Action = Action> = (a: Sequence<A>, b: Sequence<A>) => Sequence<A>

export type Validator = <A extends Action>(
  currentLink: Link<A>,
  chain: SignatureChain<A>
) => ValidationResult

export type ValidatorSet = {
  [key: string]: Validator
}

// TEAM ACTION TYPES

// TODO: the content of lockboxes needs to be validated
// e.g. only an admin can add lockboxes for others

interface BasePayload {
  // Every action might include new lockboxes
  lockboxes?: Lockbox[]
}

export interface RootAction extends Action {
  type: typeof ROOT
  payload: BasePayload & {
    teamName: string
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
    memberKeys: PublicKeyset // member keys provided by the new member
  }
}

export interface AdmitDeviceAction extends Action {
  type: 'ADMIT_DEVICE'
  payload: BasePayload & {
    id: string // invitation ID
    userName: string // user name of the device's owner
    deviceKeys: PublicKeyset // device keys provided by the new device
  }
}

export interface ChangeMemberKeysAction extends Action {
  type: 'CHANGE_MEMBER_KEYS'
  payload: BasePayload & {
    keys: PublicKeyset
  }
}

export interface ChangeDeviceKeysAction extends Action {
  type: 'CHANGE_DEVICE_KEYS'
  payload: BasePayload & {
    keys: PublicKeyset
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

export type TeamLinkBody = LinkBody<TeamAction>
export type TeamLink = Link<TeamAction>
export type TeamNonRootLink = NonRootLink<TeamAction>
export type TeamActionLink = ActionLink<TeamAction>
export type TeamLinkMap = LinkMap<TeamAction>
export type TeamSignatureChain = SignatureChain<TeamAction>
export type Branch = Sequence<TeamAction>
export type TwoBranches = [Branch, Branch]
export type ActionFilter = (link: TeamActionLink) => boolean
export type ActionFilterFactory = (branches: TwoBranches, chain: TeamSignatureChain) => ActionFilter
