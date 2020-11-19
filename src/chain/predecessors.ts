import { Link, isMergeLink, isRootLink, Action, SignatureChain } from '/chain/types'
import * as R from 'ramda'

/** Returns the set of strict predecessors of `link` */
export const getPredecessors = <A extends Action>(
  chain: SignatureChain<A>,
  link: Link<A>
): Link<A>[] => {
  const visit = (link: Link<A>): Link<A>[] => {
    const parents = getParents(chain, link)

    return parents.concat(parents.flatMap(parent => visit(parent)))
  }
  const predecessors = visit(link)
  return R.uniq(predecessors)
}

/** Returns true if `a` is a predecessor of `b` */
export const isPredecessor = <A extends Action>(
  chain: SignatureChain<A>,
  a: Link<A>,
  b: Link<A>
): boolean => getPredecessors(chain, b).includes(a)

export const getCommonPredecessor = <A extends Action>(
  chain: SignatureChain<A>,
  [a, b]: Link<A>[]
): Link<A> => {
  // are they the same node?
  if (a === b) return a

  // does one precede the other?
  if (isPredecessor(chain, a, b)) return a
  if (isPredecessor(chain, b, a)) return b

  const aPredecessors = getPredecessors(chain, a)
  const bPredecessors = getPredecessors(chain, b)
  return aPredecessors.find(link => bPredecessors.includes(link))!
}

export const getParentHashes = (chain: SignatureChain<any>, link: Link<any>) =>
  isRootLink(link)
    ? [] // root link = 0 parents
    : isMergeLink(link)
    ? [...link.body] // merge link = 2 parents
    : [link.body.prev] // normal link = 1 parent

export const getParents = (chain: SignatureChain<any>, link: Link<any>) =>
  getParentHashes(chain, link).map(hash => chain.links[hash])
