import { ChainLink, isMergeLink, isRootLink, LinkBody, SignatureChain } from '/chain/types'
import * as R from 'ramda'

export const getAncestors = <T extends LinkBody>(
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
  const ancestors = visit(link)
  return R.uniq(ancestors)
}

export const getCommonAncestor = <T extends LinkBody>(
  chain: SignatureChain<T>,
  a: ChainLink<T>,
  b: ChainLink<T>
): ChainLink<T> => {
  const aAncestors = getAncestors(chain, a)
  const bAncestors = getAncestors(chain, b)
  return aAncestors.find(link => bAncestors.includes(link))!
}
