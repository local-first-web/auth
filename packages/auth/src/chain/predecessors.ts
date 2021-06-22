import { Link, isMergeLink, isRootLink, Action, SignatureChain } from '@/chain/types'
import * as R from 'ramda'
import { memoize } from '@/util'

export const getPredecessorHashes = memoize(
  (chain: SignatureChain<any>, hash: string): string[] => {
    if (!(hash in chain.links)) return []
    const parents = getParentHashes(chain.links[hash])
    const predecessors = parents.flatMap(parent => getPredecessorHashes(chain, parent))
    return R.uniq(parents.concat(predecessors))
  }
)

export const isPredecessorHash = (chain: SignatureChain<any>, a: string, b: string) =>
  getPredecessorHashes(chain, b).includes(a)

export const getCommonPredecessorHash = memoize(
  (chain: SignatureChain<any>, a: string, b: string) => {
    if (a === b) return a

    // does one precede the other?
    if (isPredecessorHash(chain, a, b)) return a
    if (isPredecessorHash(chain, b, a)) return b

    const aPredecessors = getPredecessorHashes(chain, a)
    const bPredecessors = getPredecessorHashes(chain, b)
    return aPredecessors.find(link => bPredecessors.includes(link))
  }
)

export const getParents = (chain: SignatureChain<any>, link: Link<any>) =>
  getParentHashes(link).map(hash => chain.links[hash])

export const getParentHashes = (link: Link<any>): string[] =>
  isRootLink(link)
    ? [] // root link = 0 parents
    : isMergeLink(link)
    ? [...link.body] // merge link = 2 parents
    : [link.body.prev] // normal link = 1 parent

/** Returns true if `a` is a predecessor of `b` */
export const isPredecessor = <T extends Action>(
  chain: SignatureChain<T>,
  a: Link<T>,
  b: Link<T>
): boolean => {
  return (
    a !== undefined &&
    b !== undefined &&
    a.hash in chain.links &&
    b.hash in chain.links &&
    getPredecessorHashes(chain, b.hash).includes(a.hash)
  )
}

/** Returns the set of predecessors of `link` (not including `link`) */
export const getPredecessors = <T extends Action>(
  chain: SignatureChain<T>,
  link: Link<T>
): Link<T>[] =>
  getPredecessorHashes(chain, link.hash)
    .map(h => chain.links[h])
    .filter(link => link !== undefined)

export const getCommonPredecessor = <T extends Action = Action>(
  chain: SignatureChain<T>,
  a: Link<T>,
  b: Link<T>
) => {
  const hash = getCommonPredecessorHash(chain, a.hash, b.hash)
  if (!hash) throw new Error('no common predecessor was found')
  return chain.links[hash]
}
