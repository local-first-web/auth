import * as base64 from '@stablelib/base64'
import msgpack from 'msgpack-lite'
import nacl from 'tweetnacl'
import { symmetric } from '../crypto/symmetric'
import { stretch } from '../crypto/stretch'
import { hmac } from '../util/hmac'
import { base30 } from '../util/base30'

const TACO_INVITE_TOKEN = 'taco_invite_token'
const IKEY_LENGTH = 16
const STAGE_INVITE_ID = 'invite_id'
const STAGE_EDDSA = 'eddsa'
// const STAGE_ACCEPT = 'accept'

// implements a modified version of Keybase's Seitan Token v2 exchange specification
// http://keybase.io/docs/teams/seitan_v2

/** #### Step 1a
 * The iKey is a randomly generated secret that is sent to Bob via a pre-authenticated channel (e.g.
 * WhatsApp, iMessage, etc). If Alice is inviting Bob, only Alice and Bob will ever have this key.
 * @returns a random 16-character base30 string (from alphabet `abcdefghjkmnpqrsuvwxyz23456789`)
 */
export const newIKey = () => base30.encode(nacl.randomBytes(IKEY_LENGTH))

/** #### Step 1b
 * The iKey is stretched using `scrypt` to discourage brute-force attacks.
 * @returns a 32-character base64 string
 */
export const stretchIKey = (iKey: string) => stretch(iKey)

/** #### Step 1c
 * The invitationId is derived from the stretched iKey, so Bob can generate it independently. This
 * will be visible in the signature chain and serves to uniquely identify the invitation.
 * @returns a 15-character base64 string
 */
export const getInvitationId = (siKey: Uint8Array) => {
  const payload = { stage: STAGE_INVITE_ID }
  const invitationId = hmac(siKey, payload)
  return base64.encode(invitationId).slice(0, 15)
}

/** #### Step 1d
 * We generate a signing keypair for Bob to use to verify that he knows the iKey. This keypair is also
 * derived from the iKey, so Bob can generate it independently.
 * @param siKey The stretched invitation key
 * @returns a 32-character base64 string
 */
export const getSigningKeypair = (siKey: Uint8Array) => {
  const payload = { stage: STAGE_EDDSA }
  const seed = hmac(siKey, payload).slice(0, 32)
  return nacl.sign.keyPair.fromSeed(seed)
}

/** #### Step 2a
 * We encrypt the public half of Bob's signing key, along with his email or other human-readable
 * label.
 *
 * #### Step 2b
 *  We attach some metadata to the encrypted key and label to create a "packed key" (pKey). This
 * constitutes the invitation. It is Alice saying to other admins, 'Anyone who can prove they know
 * the secret key (iKey) that generated this invitation is accepted to be Bob and allowed in.' This
 * will be signed into the repo's signature chain, along with the invitationId.
 *
 * @param encryptionKey The repo-level symmetric encryption key generated for this purpose
 * @param repoKeyGeneration The generation of rotation of the repo key
 * @param siKey The stretched iKey
 * @param label A human-readable string identifying Bob
 * @returns a base64-encoded string
 */
export const getPKey = (
  encryptionKey: Uint8Array,
  repoKeyGeneration: number,
  signingPublicKey: Uint8Array,
  label: string
) => {
  const pKey = msgpack.encode({
    repoKeyGeneration,
    encryptedKeyAndLabel: symmetric.encrypt(
      msgpack.encode({ key: signingPublicKey, label }),
      encryptionKey
    ),
  })
  return base64.encode(pKey)
}

export const newInvitation = (iKey: string) => {
  const siKey = stretch(iKey) // 1b
  const invitationId = getInvitationId(siKey) // 1c
  const { publicKey } = getSigningKeypair(siKey) // 1d

  // TODO these are properties of the repo
  const encryptionKey = stretch('abc')
  const repoKeyGeneration = 1

  const pKey = getPKey(
    encryptionKey,
    repoKeyGeneration,
    publicKey,
    'bob@devresults.com'
  ) // 2a

  return {
    id: invitationId,
    body: pKey,
    type: TACO_INVITE_TOKEN,
  }
}

// TODO: This should live somewhere else & be precomputed when the repo is created, along with keys
// for other specific purposes. See https://keybase.io/docs/teams/crypto
export const getKeyForSymmetricEncryption = (teamKeySeed: Uint8Array) =>
  hmac(teamKeySeed, TACO_INVITE_TOKEN)
