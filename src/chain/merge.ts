import { clone } from './clone'
import { hashNode } from './hashNode'
import { MergeNode, SignatureChain } from './types'

export const merge = (a: SignatureChain, b: SignatureChain): SignatureChain => {
  if (a.root !== b.root) throw new Error('Cannot merge two chains with different roots')

  if (a.head === b.head) return clone(a) // they're the same
  if (a.nodes.has(b.head)) return clone(a) // a is ahead of b; fast forward
  if (b.nodes.has(a.head)) return clone(b) // b is ahead of a; fast forward

  // create a new map containing all nodes from both chains
  const nodes = mergeMaps(a.nodes, b.nodes)

  const root = a.root

  // create a merge node, which is just a pointer to each of the two heads
  const body = [a.head, b.head].sort() // ensure deterministic order
  const hash = hashNode(body)
  const mergeNode = { type: 'MERGE', hash, body } as MergeNode

  // add this node as the new head
  const head = hash
  nodes.set(hash, mergeNode)
  return { root, head, nodes }
}

const mergeMaps = <K, V>(a: Map<K, V>, b: Map<K, V>) => {
  const result = new Map<K, V>()
  a.forEach((v, k) => result.set(k, v))
  b.forEach((v, k) => result.set(k, v))
  return result
}
