import { GraphNode, MergeNode, NodeBody, SignatureGraph, SignedNode } from './types'

export const getHead = <T extends NodeBody>(graph: SignatureGraph<T>): GraphNode<T> =>
  graph.nodes.get(graph.head)! as GraphNode<T>
