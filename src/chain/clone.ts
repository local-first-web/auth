import { SignatureChain } from './types'

export const clone = (chain: SignatureChain) => ({ ...chain, links: new Map(chain.links) })
