import { Device } from '/device'
import { Member } from '/member'
import { Base64, Encrypted } from '/util'

/** The public invitation to be recorded on the signature chain. When Bob shows up with
 * `ProofOfInvitation`, someone on the team will need to check it against this.
 */
export interface Invitation {
  /** Public, unique identifier for the invitation */
  id: Base64

  type: InvitationBody['type']

  /** An `InvitationBody` containing Bob's username and a public signature key, symmetrically
   *  encrypted using the team key */
  encryptedBody: Encrypted<InvitationBody>

  /** Generation # of the team keyset */
  generation: number

  /** If true, this invitation has already been used to admin a member or device */
  used: Boolean

  /** If true, this invitation was revoked at some point after it was created (but before it was used) */
  revoked: Boolean
}

export type InvitationBody = (
  | {
      type: 'MEMBER'
      payload: MemberInvitationPayload
    }
  | {
      type: 'DEVICE'
      payload: DeviceInvitationPayload
    }
) & {
  publicKey: Base64
}

export interface MemberInvitationPayload {
  userName: string
  roles?: string[]
}

export interface DeviceInvitationPayload {
  deviceId: Base64
  userName: string
}

/** This is what Bob takes to the team so they'll let him in */
export type ProofOfInvitation = {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** Signature of the payload, using the signing keys derived from the secret invitation key */
  signature: Base64
} & (
  | {
      type: 'MEMBER'
      payload: Member
    }
  | {
      type: 'DEVICE'
      payload: Device
    }
)
