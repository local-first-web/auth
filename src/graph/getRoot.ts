import { NodeBody, SignatureGraph, SignedNode } from './types'

export const getRoot = <T extends NodeBody = NodeBody>(graph: SignatureGraph<T>) =>
  graph.nodes.get(graph.root) as SignedNode<T>
