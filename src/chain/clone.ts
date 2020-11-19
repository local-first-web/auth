import { Action, SignatureChain } from './types'

export const clone = <A extends Action>(chain: SignatureChain<A>) => ({
  ...chain,
  links: { ...chain.links },
})
