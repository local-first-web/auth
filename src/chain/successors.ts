import { getSequence } from './getSequence'
import { ChainLink, LinkBody, SignatureChain } from '/chain/types'

export const getSuccessors = <T extends LinkBody>(
  chain: SignatureChain<T>,
  link: ChainLink<T>
): ChainLink<T>[] => getSequence(chain, { root: link }).filter(n => n !== link)

export const isSuccessor = <T extends LinkBody>(
  chain: SignatureChain<T>,
  a: ChainLink<T>,
  b: ChainLink<T>
): boolean => getSuccessors(chain, b).includes(a)
