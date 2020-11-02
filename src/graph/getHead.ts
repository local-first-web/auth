import { MergeNode, NodeBody, SignatureGraph, SignedNode } from './types'

export const getHead = <T extends NodeBody = NodeBody>(graph: SignatureGraph<T>) =>
  graph.nodes.get(graph.head) as SignedNode<T> | MergeNode
