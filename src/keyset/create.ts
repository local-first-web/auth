import nacl from 'tweetnacl'
import { randomKey } from '/keyset/randomKey'
import { KeyScope, KeysetWithSecrets } from '/keyset/types'
import { hash, stretch } from '/crypto'
import { HashPurpose, Key, keypairToBase64, Optional } from '/lib'

/**
 * Generates a full set of per-user keys from a single 32-byte secret, roughly following the
 * procedure outlined in the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).
 *
 * @param scope The scope associated with the new keys - e.g. `{ type: TEAM }` or `{type: ROLE,
 * name: ADMIN}`.
 * @param seed (optional) A strong secret key used to derive the other keys. This key should be
 * randomly generated to begin with and never stored. If not provided, a 32-byte random key will be
 * generated and used.
 * @returns A keyset consisting of a keypair for signing and a keypair for asymmetric encryption.
 * (The secret half of the encryption key can also be used for symmetric encryption.)
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
  }
}

// private

const deriveSignatureKeys = (secretKey: Key) => {
  const hashKey = HashPurpose.Signature
  const { keyPair } = nacl.sign
  const derivedSeed = hash(hashKey, secretKey).slice(0, 32)
  const keys = keyPair.fromSeed(derivedSeed)
  return keypairToBase64(keys)
}

const deriveEncryptionKeys = (secretKey: Key) => {
  const hashKey = HashPurpose.Encryption
  const { keyPair, secretKeyLength } = nacl.box
  const derivedSecretKey = hash(hashKey, secretKey).slice(0, secretKeyLength)
  const keys = keyPair.fromSecretKey(derivedSecretKey)
  return keypairToBase64(keys)
}
