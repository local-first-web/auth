import { NodeBody, SerializableSignatureGraph, SignatureGraph } from '/graph'
import { TeamNodeBody } from '/team/types'

export const deserialize = <T extends NodeBody>(serialized: string): SignatureGraph<T> => {
  const parsed = JSON.parse(serialized) as SerializableSignatureGraph<TeamNodeBody>
  return {
    ...parsed,
    nodes: new Map(parsed.nodes),
  } as SignatureGraph<T>
}
