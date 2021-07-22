import { hash, Base58, base58 } from '@herbcaudill/crypto'
import { HashPurpose } from '@/util'

/**
 * Takes two seeds (in this case, provided by each of two peers that are connecting) and
 * @param seed1 one of the seeds to combine
 * @param seed2 the other seed to combine
 */
export const deriveSharedKey = (seed1: Base58, seed2: Base58): Base58 => {
  const sortedSeeds = [seed1, seed2].sort() // ensure that the seeds are in a deterministic order
  const concatenatedSeeds = sortedSeeds.join('')
  const sharedKey = hash(HashPurpose.SHARED_KEY, concatenatedSeeds)
  return base58.encode(sharedKey)
}
