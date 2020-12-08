import { Link, isMergeLink, isRootLink, Action, SignatureChain } from '/chain/types'
import * as R from 'ramda'

/** Returns the set of predecessors of `link` (not including `link`) */
export const getPredecessors = <T extends Action>(
  chain: SignatureChain<T>,
  link: Link<T>
): Link<T>[] => {
  const parents = getParents(chain, link)
  const predecessors = parents.flatMap(parent => getPredecessors(chain, parent))
  return R.uniq(parents.concat(predecessors))
}

// TODO make these signatures consistent -
// chain, [a,b]

/** Returns true if `a` is a predecessor of `b` */
export const isPredecessor = <T extends Action>(
  chain: SignatureChain<T>,
  a: Link<T>,
  b: Link<T>
): boolean => getPredecessors(chain, b).includes(a)

// TODO: probably want to memoize this

export const getCommonPredecessor = <T extends Action = Action>(
  chain: SignatureChain<T>,
  [a, b]: Link<T>[]
): Link<T> => {
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
