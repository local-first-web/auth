import { type Base58, type UnixTimestamp } from '@localfirst/crdx'

/** Properties shared by both kinds of invitation. */
type InvitationBase = {
  /** Public, unique identifier for the invitation */
  id: Base58

  /** The public signing key derived from the secret invitation key */
  publicKey: Base58

  /** Time when the invitation expires. If 0, the invitation does not expire. */
  expiration: UnixTimestamp

  /** Number of times the invitation can be used. If 0, the invitation can be used any number of times. */
  maxUses: number
}

/** An invitation to join the team as a new member. */
export type MemberInvitation = {
  kind: 'MEMBER'
} & InvitationBase

/** An invitation for a new device belonging to a member who is already on the team. */
export type DeviceInvitation = {
  kind: 'DEVICE'

  /** The member the device will belong to. */
  userId: string
} & InvitationBase

/**
 * The public record of the invitation that Alice adds to the signature chain after inviting Bob
 * (or, that Bob's laptop adds after inviting Bob's phone).
 *
 * `kind` says which of the two this is, and the union ties the device owner to it: `userId` is
 * present exactly when the invitation is a device invitation. That's a compile-time guarantee about
 * the code that builds invitations, not a runtime one about invitations arriving on the graph — a
 * member can author an `INVITE_*` link directly, so `kind` still has to be validated against the
 * link that posts it (see `invitationsNameTheRightKindAndOwner`).
 * */
export type Invitation = MemberInvitation | DeviceInvitation

/**
 * The current state of the invitation; appears in the Team state. These properties are populated
 * by the reducer.
 * */
export type InvitationState = Invitation & {
  /** Number of times the invitation has been used */
  uses: number

  /** If true, this invitation was revoked at some point after it was created (but before it was used) */
  revoked: boolean

  /**
   * The invitees this invitation has already admitted — userIds for a member invitation, deviceIds
   * for a device invitation. An invitation that can be used more than once is for admitting more
   * than one person, not for admitting the same one twice: proofs are published on the graph, so
   * without this any member could replay one.
   */
  admitted: string[]

  /**
   * The encryption public key of the ear this invitation was posted with, if it came with one —
   * the keyset lockboxes for the invitee are addressed to.
   *
   * `publicKey` above is the SIGNATURE half of the starter keys, which is what a proof is checked
   * against; the encryption half is what a lockbox is addressed to, and the two are independent
   * derivations from the seed, so one does not give you the other. Recording it here is what lets
   * `lockboxesInScope` tell the invitation's own ear from a lockbox somebody else addressed to a
   * keyset of their own while copying this invitation's signature key onto the manifest.
   */
  earPublicKey?: Base58
}

/**
 * The document an invitee presents the first time they connect to an admin, to prove that they've
 * been invited.
 * */
export type ProofOfInvitation = {
  /** Public, unique identifier for the invitation */
  id: Base58

  /**
   * The identifier the invitee will be admitted under: their `userId` for a member invitation, or
   * their `deviceId` for a device invitation. Binding this into the signature is what keeps the
   * proof from being a bearer token — someone who intercepts a proof can't present it under
   * identifiers of their own choosing.
   */
  invitee: string

  /**
   * Fingerprint of the invitee's own public keyset (see `hashKeys`). The invitee chooses these keys
   * and signs the fingerprint into the proof, so they can only be admitted under the keys they
   * chose. Without it the ADMITTER picks the keys: the identifier would be the invitee's, but the
   * secrets would be the admitter's, and from that point on the admitter could author links as the
   * invitee and register devices under them.
   */
  keyHash: Base58

  /**
   * Signature over the invitation id, the invitee, and the invitee's key fingerprint, using the
   * private signing key derived from the secret invitation key
   */
  signature: Base58
}
