import { SignatureGraph } from './types'

export * from './types'
export * from './append'
export * from './create'

export const getRoot = (graph: SignatureGraph) => graph.nodes.get(graph.root)!
export const getHead = (graph: SignatureGraph) => graph.nodes.get(graph.head)!
