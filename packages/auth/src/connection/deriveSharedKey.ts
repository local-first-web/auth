import { hash, Base58, base58 } from '@herbcaudill/crypto'
import { HashPurpose } from '@/util'

/**
 * Takes two seeds (in this case, provided by each of two peers that are connecting) and
 * deterministically derives a shared key.
 */
export const deriveSharedKey = (seed1: Base58, seed2: Base58): Base58 => {
  const concatenatedSeeds = [seed1, seed2]
    .sort() // ensure that the seeds are in a predictable order
    .map(s => base58.decode(s)) // convert to byte arrays
    .reduce((a, b) => new Uint8Array([...a, ...b]), new Uint8Array()) // concatenate

  const sharedKey = hash(HashPurpose.SHARED_KEY, concatenatedSeeds)
  return sharedKey
}
