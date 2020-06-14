import * as utf8 from '@stablelib/utf8'
import nacl from 'tweetnacl'
import scrypt from 'scryptsy'
import memoize from 'fast-memoize'

/**
 * Uses the `scrypt` algorithm to deterministically derive a 32-byte key from the password provided.
 * @password The password to use as a seed
 * @returns A derived 32-byte secret key to use for symmetric encryption or other purposes
 */
export const stretch = memoize((password: string | Uint8Array) => {
  const salt = 'Sõdìüm ÇhLôrɩdé'
  const passwordBytes = typeof password === 'string' ? utf8.encode(password) : password

  // `scrypt` is intended to be expensive not only in CPU time but in memory usage.
  // These parameters are calibrated to keep the derivation time around 100ms "on my box"
  // as per author recommendations. See http://tarsnap.com/scrypt/scrypt.pdf
  const blockSizeFactor = 8
  const costFactor = 2 ** 11
  const parallelizationFactor = 1
  return scrypt(
    Buffer.from(passwordBytes),
    salt,
    costFactor,
    blockSizeFactor,
    parallelizationFactor,
    nacl.secretbox.keyLength // = 32
  )
})
