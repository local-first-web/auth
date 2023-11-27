import { hash, hashBytes, type Base58, base58 } from '@localfirst/crypto'
import { HashPurpose } from 'util/index.js'

/**
 * Takes two seeds (in this case, provided by each of two peers that are connecting) and
 * deterministically derives a shared key.
 */
export const deriveSharedKey = <T extends Base58 | Uint8Array>(a: T, b: T): T => {
  const aBytes = typeof a === 'string' ? base58.decode(a) : (a as Uint8Array)
  const bBytes = typeof b === 'string' ? base58.decode(b) : (b as Uint8Array)
  const concatenatedSeeds = [aBytes, bBytes]
    .sort() // Ensure that the seeds are in a predictable order
    .reduce((result, seed) => new Uint8Array([...result, ...seed]), new Uint8Array()) // Concatenate

  const hashFn = typeof a === 'string' ? hash : hashBytes
  return hashFn(HashPurpose.SHARED_KEY, concatenatedSeeds) as T
}
