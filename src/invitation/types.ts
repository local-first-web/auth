import { Base64, Encrypted } from '/util'
import { Member } from '/member'
import { Device } from '/device'

/** The public invitation to be recorded on the signature chain. When Bob shows up with
 * `ProofOfInvitation`, someone on the team will need to check it against this.
 */
export interface Invitation {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** An `InvitationBody` containing Bob's username and a public signature key, symmetrically
   *  encrypted using the team key */
  encryptedBody: Encrypted<InvitationBody>

  /** Generation # of the team keyset */
  generation: number
}

export interface MemberInvitationPayload {
  userName: string
  roles?: string[]
}

export interface DeviceInvitationPayload {
  deviceId: Base64
  userName: string
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

/** This is what Bob takes to the team so they'll let him in */
export interface ProofOfInvitation {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** Bob's username and public keys*/
  member: Member

  /** Bob's first device */
  device: Device

  /** Signature of the invitation id and Bob's username, using the signing keys derived from the
   * secret invitation key */
  signature: Base64
}
