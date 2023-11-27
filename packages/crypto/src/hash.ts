import sodium from 'libsodium-wrappers-sumo'
import { type Payload } from './types.js'
import { base58, keyToBytes } from './util/index.js'
import { pack } from 'msgpackr'

/** Computes a fixed-length fingerprint for an arbitrary long message. */

export const hash = (
  /** A seed used to distinguish different hashes derived from a given payload. */
  seed: string,
  /** The data to hash. */
  payload: Payload
) => {
  return base58.encode(hashBytes(seed, payload))
}

export const hashBytes = (
  /** A seed used to distinguish different hashes derived from a given payload. */
  seed: string,
  /** The data to hash. */
  payload: Payload
) => {
  const seedBytes = keyToBytes(seed, 'utf8')
  const payloadBytes = pack(payload)
  return sodium.crypto_generichash(32, payloadBytes, seedBytes)
}
