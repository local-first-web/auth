import { Lockbox } from '/lockbox'
import { Base64, Encrypted } from '/util'

// INVITATION

export interface InvitationBody {
  userName: string
  publicKey: Base64 // public half of the ephemeral signature key
}

export interface Invitation {
  /** Public, unique identifier for the invitation */
  id: Base64

  encryptedBody: Encrypted<InvitationBody>

  /** Generation # of the team keyset */
  generation: number

  /** If true, this invitation has already been used to admin a member or device */
  used?: Boolean

  /** If true, this invitation was revoked at some point after it was created (but before it was used) */
  revoked?: Boolean
}

// PROOF OF INVITATION

/** This is what Bob takes to the team so they'll let him in */
export interface ProofOfInvitation {
  /** Public, unique identifier for the invitation */
  id: Base64

  /** The invitee's user name*/
  userName: string

  /** Signature of userName and id, using the signing keys derived from the secret invitation key */
  signature: Base64
}
