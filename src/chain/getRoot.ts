import { NodeBody, RootNode, SignatureChain } from './types'

export const getRoot = <T extends NodeBody>(chain: SignatureChain<T>): RootNode =>
  chain.nodes.get(chain.root) as RootNode
