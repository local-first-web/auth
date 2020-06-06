import { Base64, Encrypted } from '/lib'
import { Member } from '/member'

/** The public invitation to be recorded on the signature chain. When Bob shows up with
`ProofOfInvitation`, someone on the team will need to check it against this. */
export interface Invitation {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** An `InvitationPayload` containing Bob's username and a public signature key, symmetrically
   * encrypted using the team key */
  encryptedPayload: Encrypted<InvitationPayload>

  /** Generation # of the team keyset */
  generation: number
}

export interface InvitationPayload {
  userName: string
  roles?: string[]
  publicKey: Base64
}

/** This is what Bob takes to the team so they'll let him in */
export interface ProofOfInvitation {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** Bob's username and public keys*/
  member: Member

  /** Signature of the invitation id and Bob's username, using the signing keys derived from the
   * secret invitation key */
  signature: Base64
}
