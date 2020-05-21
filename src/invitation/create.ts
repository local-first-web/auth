import nacl from 'tweetnacl'
import { symmetric } from '/crypto'
import { KeysetWithSecrets, deriveKeys } from '/keys'
import { base30 } from '/lib'
import { InvitationAndSecretKey, InvitationPayload, Invitation } from '/invitation/types'
import { deriveId } from '/invitation/deriveId'

const IKEY_LENGTH = 16

// Implements a modified version of Keybase's Seitan Token v2 exchange specification. Step numbers
// refer to this page: http://keybase.io/docs/teams/seitan_v2

/**
 * Returns a secret key to give Bob, as well as an invitation to public post on the team's signature chain.
 * @param teamKeys The global team keys (Alice obtains these from the appropriate lockbox)
 * @param userName Bob's username
 */
export const create = (teamKeys: KeysetWithSecrets, userName: string): InvitationAndSecretKey => {
  const generation = teamKeys.generation || 0

  // ## Step 1a
  // The invitation key is a randomly generated secret that is sent to Bob via a pre-authenticated
  // channel (e.g. WhatsApp). If Alice is inviting Bob, only Alice and Bob will ever have this key.
  // (Keybase docs refer to this as `iKey`)
  const secretKey = base30.encode(nacl.randomBytes(IKEY_LENGTH))

  // ## Step 1b, 1c
  // Stretch the key and hash it to obtain an invitation ID (Keybase docs: `inviteID`)
  const id = deriveId(secretKey)

  // ## Step 1d
  // Generate a signing keypair for Bob to use to verify that he knows the iKey. This keypair is
  // also derived from the iKey, so Bob can generate it independently.
  const { publicKey } = deriveKeys(secretKey).signature

  // ## Step 2a
  // Encrypt Bob's username so that we don't leak it in the public signature chain. We also include
  // the public half of the signature keyset, which will be used to verify Bob's proof of invitation.
  const payload: InvitationPayload = { userName, publicKey }
  const body = symmetric.encrypt(payload, teamKeys.symmetric.key)

  // ## Step 2b
  // We put it all together to create the invitation.
  const invitation: Invitation = { id, encryptedPayload: body, generation }
  return { secretKey, invitation }
}
