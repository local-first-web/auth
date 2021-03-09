import { KeyScope, KeyType } from '@/keyset'
import { Base64, Encrypted } from '@/util'

// INVITATION

export interface InvitationBody {
  /** The user or device to invite (e.g. `{type: MEMBER, name: userName}` or `{type: DEVICE, name: deviceId}` */
  invitee: Invitee
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

  /** The user or device that was invited */
  invitee: Invitee

  /** Signature of userName and id, using the signing keys derived from the secret invitation key */
  signature: Base64
}

export interface Invitee extends KeyScope {
  type: typeof KeyType.MEMBER | typeof KeyType.DEVICE
  name: string
}
