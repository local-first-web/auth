import * as base64 from '@stablelib/base64'
import nacl from 'tweetnacl'
import { hash, stretch } from '/crypto'
import { KeysetWithSecrets } from '/keys/types'
import { HashPurpose, Key, keypairToBase64 } from '/lib'

/**
 * Generates a full set of per-user keys from a single 32-byte secret, roughly following the
 * procedure outlined in the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).
 *
 * @param seed A 32-byte secret key used to derive all other keys. This key should be randomly
 * generated to begin with, then stored in the device's secure storage. It should never leave the
 * original device except in encrypted form.
 * @returns A `Keyset` consisting of a keypair for signing, a keypair for asymmetric encryption, and
 * a key for symmetric encryption (along with the original seed).
 */
export const deriveKeys = (seed: string): KeysetWithSecrets => {
  const stretchedSeed = stretch(seed)
  return {
    seed,
    signature: deriveSignatureKeys(stretchedSeed),
    asymmetric: deriveAsymmetricKeys(stretchedSeed),
    symmetric: deriveSymmetricKey(stretchedSeed),
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

const deriveAsymmetricKeys = (secretKey: Key) => {
  const hashKey = HashPurpose.EncryptionAsymmetric
  const { keyPair, secretKeyLength } = nacl.box
  const derivedSecretKey = hash(hashKey, secretKey).slice(0, secretKeyLength)
  const keys = keyPair.fromSecretKey(derivedSecretKey)
  return keypairToBase64(keys)
}

const deriveSymmetricKey = (secretKey: Key) => {
  const hashKey = HashPurpose.EncryptionSymmetric
  const key = hash(hashKey, secretKey).slice(0, 32)
  return { key: base64.encode(key) }
}
