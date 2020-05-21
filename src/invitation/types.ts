import { Base64, Encrypted } from '/lib'

/** The return value of `invitation.create()` is a secret key for Bob, and a public invitation for
 * the signature chain.  */
export interface InvitationAndSecretKey {
  /** Randomly generated secret that Alice sends to Bob via a pre-authenticated channel */
  secretKey: Base64

  /** Public invitation to be recorded on the signature chain.*/
  invitation: Invitation
}

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
  publicKey: Base64
}

/** This is what Bob takes to the team so they'll let him in */
export interface ProofOfInvitation {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** Bob's username */
  userName: string

  /** Signature of the invitation id and Bob's username, using the signing keys derived from the
   * secret invitation key */
  signature: Base64
}
