import { NodeBody, RootNode, SignatureGraph } from './types'

export const getRoot = <T extends NodeBody>(graph: SignatureGraph<T>): RootNode =>
  graph.nodes.get(graph.root) as RootNode
