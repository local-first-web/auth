import { LinkBody, SignatureChain } from '/chain'

export const serialize = <T extends LinkBody>(chain: SignatureChain<T>) => {
  return JSON.stringify(chain)
}
