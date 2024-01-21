// ignore file coverage

import sodium from 'libsodium-wrappers-sumo'
import { memoize } from '@localfirst/shared'
import type { Password, Base58 } from './types.js'
import { base58, keyToBytes } from './util/index.js'

/**
 * Derives a key from a low-entropy input, such as a password. Current version of libsodium
 * uses the Argon2id algorithm, although that may change in later versions.
 */
export const stretch = memoize((password: Password) => {
  const passwordBytes = typeof password === 'string' ? keyToBytes(password, 'utf8') : password
  const salt = base58.decode('H5B4DLSXw5xwNYFdz1Wr6e' as Base58)
  if (passwordBytes.length >= 16) {
    // It's long enough -- just hash to expand it to 32 bytes
    return sodium.crypto_generichash(32, passwordBytes, salt)
  }

  const opsLimit = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE
  const memLimit = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
  return sodium.crypto_pwhash(
    32,
    passwordBytes,
    salt,
    opsLimit,
    memLimit,
    sodium.crypto_pwhash_ALG_DEFAULT
  )
})
