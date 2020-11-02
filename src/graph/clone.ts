import { SignatureGraph } from './types'

export const clone = (graph: SignatureGraph) => ({ ...graph, nodes: new Map(graph.nodes) })
