import { NodeBody, SerializableSignatureChain, SignatureChain } from '/chain'
import { TeamNodeBody } from '/team/types'

export const serialize = <T extends NodeBody>(chain: SignatureChain<T>) => {
  const serializableChain = {
    ...chain,
    nodes: Array.from(chain.nodes.entries()),
  } as SerializableSignatureChain<TeamNodeBody>

  return JSON.stringify(serializableChain)
}
