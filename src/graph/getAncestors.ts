import { GraphNode, isMergeNode, isRootNode, NodeBody, SignatureGraph } from '/graph/types'
import * as R from 'ramda'

export const getAncestors = <T extends NodeBody>(
  graph: SignatureGraph<T>,
  node: GraphNode<T>
): GraphNode<T>[] => {
  const visit = (node: GraphNode<T>): GraphNode<T>[] => {
    const parents = isRootNode(node)
      ? [] // root node
      : isMergeNode(node)
      ? node.body.map(hash => graph.nodes.get(hash)!) // merge node
      : [graph.nodes.get(node.body.prev!)!] // other node

    return parents.concat(parents.flatMap(parent => visit(parent)))
  }
  const ancestors = visit(node)
  return R.uniq(ancestors)
}

export const getCommonAncestor = <T extends NodeBody>(
  graph: SignatureGraph<T>,
  a: GraphNode<T>,
  b: GraphNode<T>
): GraphNode<T> => {
  const aAncestors = getAncestors(graph, a)
  const bAncestors = getAncestors(graph, b)
  return aAncestors.find(node => bAncestors.includes(node))!
}
