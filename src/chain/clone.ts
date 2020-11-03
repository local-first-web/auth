import { SignatureChain } from './types'

export const clone = (chain: SignatureChain) => ({ ...chain, nodes: new Map(chain.nodes) })
