import * as base64 from '@stablelib/base64'
import { hmac, keypairToBase64 } from '../lib'
import nacl from 'tweetnacl'
import { Key } from '/types'
import { HashPurpose } from '../constants'
import { Keyset } from './types'

/**
 * Generates a full set of per-user keys from a single 32-byte secret, roughly following the
 * procedure outlined in the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).
 *
 * @param secretKey A 32-byte secret key used to derive all other keys. This key should be randomly
 * generated to begin with, then stored in the device's secure storage. It should never leave the
 * original device except in encrypted form.
 * @returns A `Keyset` consisting of a keypair for signing, a keypair for asymmetric encryption, and
 * a key for symmetric encryption.
 */
export const deriveKeys = (secretKey: Key): Keyset => ({
  signature: deriveSignatureKeys(secretKey),
  asymmetric: deriveAsymmetricKeys(secretKey),
  symmetric: deriveSymmetricKey(secretKey),
})

// private

const deriveSignatureKeys = (secretKey: Key) => {
  const hashKey = HashPurpose.Signature
  const { keyPair } = nacl.sign
  const derivedSeed = hmac(hashKey, secretKey).slice(0, 32)
  const keys = keyPair.fromSeed(derivedSeed)
  return keypairToBase64(keys)
}

const deriveAsymmetricKeys = (secretKey: Key) => {
  const hashKey = HashPurpose.EncryptionAsymmetric
  const { keyPair, secretKeyLength } = nacl.box
  const derivedSecretKey = hmac(hashKey, secretKey).slice(0, secretKeyLength)
  const keys = keyPair.fromSecretKey(derivedSecretKey)
  return keypairToBase64(keys)
}

const deriveSymmetricKey = (secretKey: Key) => {
  const hashKey = HashPurpose.EncryptionSymmetric
  const key = hmac(hashKey, secretKey).slice(0, 32)
  return { key: base64.encode(key) }
}
