import { ChainNode, isMergeNode, isRootNode, NodeBody, SignatureChain } from '/chain/types'
import * as R from 'ramda'

export const getAncestors = <T extends NodeBody>(
  chain: SignatureChain<T>,
  node: ChainNode<T>
): ChainNode<T>[] => {
  const visit = (node: ChainNode<T>): ChainNode<T>[] => {
    const parents = isRootNode(node)
      ? [] // root node
      : isMergeNode(node)
      ? node.body.map(hash => chain.nodes.get(hash)!) // merge node
      : [chain.nodes.get(node.body.prev!)!] // other node

    return parents.concat(parents.flatMap(parent => visit(parent)))
  }
  const ancestors = visit(node)
  return R.uniq(ancestors)
}

export const getCommonAncestor = <T extends NodeBody>(
  chain: SignatureChain<T>,
  a: ChainNode<T>,
  b: ChainNode<T>
): ChainNode<T> => {
  const aAncestors = getAncestors(chain, a)
  const bAncestors = getAncestors(chain, b)
  return aAncestors.find(node => bAncestors.includes(node))!
}
