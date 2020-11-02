import { NodeBody, SerializableSignatureGraph, SignatureGraph } from '/graph'
import { TeamNodeBody } from '/team/types'

export const serialize = <T extends NodeBody>(graph: SignatureGraph<T>) => {
  const serializableGraph = {
    ...graph,
    nodes: Array.from(graph.nodes.entries()),
  } as SerializableSignatureGraph<TeamNodeBody>

  return JSON.stringify(serializableGraph)
}
