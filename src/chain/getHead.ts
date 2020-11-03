import { ChainNode, MergeNode, NodeBody, SignatureChain, SignedNode } from './types'

export const getHead = <T extends NodeBody>(chain: SignatureChain<T>): ChainNode<T> =>
  chain.nodes.get(chain.head)! as ChainNode<T>
