import nacl from 'tweetnacl'
import { randomKey } from '/keyset/randomKey'
import { KeyScope, KeysetWithSecrets } from '/keyset/types'
import { hash, stretch } from '/crypto'
import { HashPurpose, Key, keypairToBase64, Optional, base64 } from '/util'

const { SIGNATURE, ENCRYPTION, SYMMETRIC } = HashPurpose

/**
 * Generates a full set of per-user keys from a single 32-byte secret, roughly following the
 * procedure outlined in the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).
 *
 * @param scope The scope associated with the new keys - e.g. `{ type: TEAM }` or `{type: ROLE,
 * name: ADMIN}`.
 * @param seed (optional) A strong secret key used to derive the other keys. This key should be
 * randomly generated to begin with and never stored. If not provided, a 32-byte random key will be
 * generated and used.
 * @returns A keyset consisting of a keypair for signing, a keypair for asymmetric encryption, and
 * a key for symmetric encryption.
 */
export const create = (
  { type, name = type }: Optional<KeyScope, 'name'>,
  seed: string = randomKey()
): KeysetWithSecrets => {
  const stretchedSeed = stretch(seed)
  return {
    type,
    name,
    generation: 0,
    signature: deriveSignatureKeys(stretchedSeed),
    encryption: deriveEncryptionKeys(stretchedSeed),
    secretKey: deriveSymmetricKey(stretchedSeed),
  }
}

// private

const deriveSignatureKeys = (secretKey: Key) => {
  const { keyPair } = nacl.sign
  const derivedSeed = hash(SIGNATURE, secretKey).slice(0, 32)
  const keys = keyPair.fromSeed(derivedSeed)
  return keypairToBase64(keys)
}

const deriveEncryptionKeys = (secretKey: Key) => {
  const { keyPair, secretKeyLength } = nacl.box
  const derivedSecretKey = hash(ENCRYPTION, secretKey).slice(0, secretKeyLength)
  const keys = keyPair.fromSecretKey(derivedSecretKey)
  return keypairToBase64(keys)
}

const deriveSymmetricKey = (secretKey: Key) => {
  const derivedKey = hash(SYMMETRIC, secretKey)
  return base64.encode(derivedKey)
}
