import { Device } from '/device'
import { Lockbox } from '/lockbox'
import { Member } from '/member'
import { Base64, Encrypted } from '/util'

// INVITATION

/** The minimal information needed to make an invitation for a member */
export interface MemberInvitationPayload {
  userName: string
  roles?: string[]
}

/** The minimal information needed to make an invitation for a device */
export interface DeviceInvitationPayload {
  deviceId: Base64
  userName: string
}

interface InvitationBase {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** Generation # of the team keyset */
  generation: number

  /** If true, this invitation has already been used to admin a member or device */
  used: Boolean

  /** If true, this invitation was revoked at some point after it was created (but before it was used) */
  revoked: Boolean
}

export interface MemberInvitation extends InvitationBase {
  type: 'MEMBER'
  encryptedBody: Encrypted<MemberInvitationBody>
}

export interface DeviceInvitation extends InvitationBase {
  type: 'DEVICE'
  encryptedBody: Encrypted<DeviceInvitationBody>
}

export type Invitation = MemberInvitation | DeviceInvitation

/** The public invitation to be recorded on the signature chain. When Bob shows up with
 * `ProofOfInvitation`, someone on the team will need to check it against this. */

// INVITATION BODY

interface InvitationBodyBase {
  publicKey: Base64
  lockboxes: Lockbox[]
}

export interface MemberInvitationBody extends InvitationBodyBase {
  type: 'MEMBER'
  payload: MemberInvitationPayload
}

export interface DeviceInvitationBody extends InvitationBodyBase {
  type: 'DEVICE'
  payload: DeviceInvitationPayload
}

export type InvitationBody = MemberInvitationBody | DeviceInvitationBody

// PROOF OF INVITATION

interface ProofOfInvitationBase {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** Signature of the payload, using the signing keys derived from the secret invitation key */
  signature: Base64
}

export interface MemberProofOfInvitation extends ProofOfInvitationBase {
  type: 'MEMBER'
  payload: Member
}

export interface DeviceProofOfInvitation extends ProofOfInvitationBase {
  type: 'DEVICE'
  payload: Device
}

/** This is what Bob takes to the team so they'll let him in */
export type ProofOfInvitation = MemberProofOfInvitation | DeviceProofOfInvitation
