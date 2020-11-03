import { NodeBody, SerializableSignatureChain, SignatureChain } from '/chain'
import { TeamNodeBody } from '/team/types'

export const deserialize = <T extends NodeBody>(serialized: string): SignatureChain<T> => {
  const parsed = JSON.parse(serialized) as SerializableSignatureChain<TeamNodeBody>
  return {
    ...parsed,
    nodes: new Map(parsed.nodes),
  } as SignatureChain<T>
}
