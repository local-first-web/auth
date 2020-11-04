import { ChainLink, MergeLink, LinkBody, SignatureChain, SignedLink } from './types'

export const getHead = <T extends LinkBody>(chain: SignatureChain<T>): ChainLink<T> =>
  chain.links[chain.head]! as ChainLink<T>
