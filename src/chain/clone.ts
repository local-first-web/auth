import { LinkBody, SignatureChain } from './types'

export const clone = <T extends LinkBody>(chain: SignatureChain<T>) => ({
  ...chain,
  links: { ...chain.links },
})
