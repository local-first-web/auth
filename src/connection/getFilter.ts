import { BloomFilter } from 'bloomfilter'
import { SignatureChain } from '/chain'

export const getFilter = (chain: SignatureChain<any>) => {
  const filter = new BloomFilter(
    // TODO: Can we be smart about these parameters?
    32 * 256,
    16 // number of hash functions.
  )
  for (const hash in chain.links) filter.add(hash)
  return filter
}
