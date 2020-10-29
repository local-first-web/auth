import { hashNode } from './hashNode'
import { MergeNode, SignatureGraph } from './types'

export const merge = (a: SignatureGraph, b: SignatureGraph): SignatureGraph => {
  if (a.root !== b.root) throw new Error('Cannot merge two graphs with different roots')

  if (a.head === b.head) return a // they're the same
  if (a.nodes.has(b.head)) return a // a is ahead of b; fast forward
  if (b.nodes.has(a.head)) return b // b is ahead of a; fast forward

  // create a new map containing all nodes from both graphs
  const nodes = mergeMaps(a.nodes, b.nodes)

  const root = a.root

  // create a merge node, which is just a pointer to each of the two heads
  const mergeNode = [a.head, b.head].sort() as MergeNode

  // add this node as the new head
  const head = hashNode(mergeNode)
  nodes.set(head, mergeNode)

  return { root, head, nodes }
}

const mergeMaps = <K, V>(a: Map<K, V>, b: Map<K, V>) => {
  const result = new Map<K, V>()
  a.forEach((v, k) => result.set(k, v))
  b.forEach((v, k) => result.set(k, v))
  return result
}
