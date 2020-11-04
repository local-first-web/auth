import { LinkBody, SignatureChain } from '/chain'

export const deserialize = <T extends LinkBody>(serialized: string): SignatureChain<T> => {
  return JSON.parse(serialized) as SignatureChain<T>
}
