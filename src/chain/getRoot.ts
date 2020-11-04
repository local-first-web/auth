import { LinkBody, RootLink, SignatureChain } from './types'

export const getRoot = <T extends LinkBody>(chain: SignatureChain<T>): RootLink =>
  chain.links[chain.root] as RootLink
