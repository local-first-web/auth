import nacl from 'tweetnacl'
import { hash, stretch, symmetric } from '/crypto'
import { KeysetWithSecrets, deriveKeys } from '/keys'
import { base30, base64, HashPurpose } from '/lib'
import { Invitation } from '/invitation/types'

const IKEY_LENGTH = 16

// Implements a modified version of Keybase's Seitan Token v2 exchange specification. Step numbers
// refer to this page: http://keybase.io/docs/teams/seitan_v2

export const create = (teamKeys: KeysetWithSecrets, userName: string): Invitation => {
  // ## Step 1a
  // The invitation key is a randomly generated secret that is sent to Bob via a pre-authenticated
  // channel (e.g. WhatsApp). If Alice is inviting Bob, only Alice and Bob will ever have this key.
  // (Keybase docs refer to this as `iKey`)
  const key = base30.encode(nacl.randomBytes(IKEY_LENGTH))

  // ## Step 1b, 1c
  // Stretch the key and hash it to obtain an invitation ID
  const id = deriveInvitationId(key)

  // ## Step 1d
  // Generate a signing keypair for Bob to use to verify that he knows the iKey. This keypair is
  // also derived from the iKey, so Bob can generate it independently.
  const { publicKey } = deriveKeys(key).signature

  // ## Step 2a
  // Encrypt Bob's username so that we don't leak it in the public signature chain.

  // TODO: We also include the public half of the signature key for some reason (Keybase docs: "the
  // pubKey is included in this encrypted blob, although it is not necessary for any security
  // properties").
  const body = symmetric.encrypt({ userName, publicKey }, teamKeys.symmetric.key)

  // ## Step 2b
  // We put it all together to create the invitation. This object is Alice saying to other members,
  // 'Anyone who can prove they know the secret key that generated this invitation is recognized as
  // Bob and admitted.' This will be signed into the team's signature chain, along with the
  // invitation id.

  const generation = teamKeys.generation || 0
  return { key, id, body, generation }
}

export function deriveInvitationId(key: string) {
  // ## Step 1b
  // The iKey is stretched using `scrypt` to discourage brute-force attacks (docs refer to this as
  // the `siKey`)

  const stretchedKey = stretch(key)

  // ## Step 1c
  // The invitation id is derived from the stretched iKey, so Bob can generate it independently.
  // This will be visible in the signature chain and serves to uniquely identify the invitation.
  // (Keybase docs: `inviteID`)

  return base64.encode(hash(HashPurpose.InvitationIdFromInvitationKey, stretchedKey)).slice(0, 15)
}
