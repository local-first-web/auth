import { type Base58, type UnixTimestamp } from '@localfirst/crdx'

/**
 * The public record of the invitation that Alice adds to the signature chain after inviting Bob
 * (or, that Bob's laptop adds after inviting Bob's phone).
 * */
export type Invitation = {
  /** Public, unique identifier for the invitation */
  id: Base58

  /** The public signing key derived from the secret invitation key */
  publicKey: Base58

  /** Time when the invitation expires. If 0, the invitation does not expire. */
  expiration: UnixTimestamp

  /** Number of times the invitation can be used. If 0, the invitation can be used any number of times. */
  maxUses: number

  /** (Device invitations only) User name the device will be associated with. */
  userId?: string
}

/**
 * The current state of the invitation; appears in the Team state. These properties are populated
 * by the reducer.
 * */
export type InvitationState = {
  /** Number of times the invitation has been used */
  uses: number

  /** If true, this invitation was revoked at some point after it was created (but before it was used) */
  revoked: boolean
} & Invitation

/**
 * The document an invitee presents the first time they connect to an admin, to prove that they've
 * been invited.
 * */
export type ProofOfInvitation = {
  /** Public, unique identifier for the invitation */
  id: Base58

  /** Signature of userId and invitation id, using the private signing key derived from the secret invitation key */
  signature: Base58
}
