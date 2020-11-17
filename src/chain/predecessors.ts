import { ChainLink, isMergeLink, isRootLink, LinkBody, SignatureChain } from '/chain/types'
import * as R from 'ramda'

/** Returns the set of strict predecessors of `link`. */
export const getPredecessors = <T extends LinkBody>(
  chain: SignatureChain<T>,
  link: ChainLink<T>
): ChainLink<T>[] => {
  const visit = (link: ChainLink<T>): ChainLink<T>[] => {
    const parents = isRootLink(link)
      ? [] // root link = 0 parents
      : isMergeLink(link)
      ? link.body.map(hash => chain.links[hash]!) // merge link = 2 parents
      : [chain.links[link.body.prev!]!] // normal link = 1 parent

    return parents.concat(parents.flatMap(parent => visit(parent)))
  }
  const predecessors = visit(link)
  return R.uniq(predecessors)
}

/** Returns true if `a` is a predecessor of `b`. */
export const isPredecessor = <T extends LinkBody>(
  chain: SignatureChain<T>,
  a: ChainLink<T>,
  b: ChainLink<T>
): boolean => getPredecessors(chain, b).includes(a)

export const getCommonPredecessor = <T extends LinkBody>(
  chain: SignatureChain<T>,
  [a, b]: ChainLink<T>[]
): ChainLink<T> => {
  // are they the same node?
  if (a === b) return a

  // does one precede the other?
  if (isPredecessor(chain, a, b)) return a
  if (isPredecessor(chain, b, a)) return b

  const aPredecessors = getPredecessors(chain, a)
  const bPredecessors = getPredecessors(chain, b)
  return aPredecessors.find(link => bPredecessors.includes(link))!
}
