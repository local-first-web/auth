import { ChainLink, isMergeLink, isRootLink, LinkBody, SignatureChain } from '/chain/types'
import * as R from 'ramda'

export const getPredecessors = <T extends LinkBody>(
  chain: SignatureChain<T>,
  link: ChainLink<T>
): ChainLink<T>[] => {
  const visit = (link: ChainLink<T>): ChainLink<T>[] => {
    const parents = isRootLink(link)
      ? [] // root link
      : isMergeLink(link)
      ? link.body.map(hash => chain.links[hash]!) // merge link
      : [chain.links[link.body.prev!]!] // other link

    return parents.concat(parents.flatMap(parent => visit(parent)))
  }
  const predecessors = visit(link)
  return R.uniq(predecessors)
}

export const getCommonPredecessor = <T extends LinkBody>(
  chain: SignatureChain<T>,
  a: ChainLink<T>,
  b: ChainLink<T>
): ChainLink<T> => {
  const aPredecessors = getPredecessors(chain, a)
  const bPredecessors = getPredecessors(chain, b)
  return aPredecessors.find(link => bPredecessors.includes(link))!
}
