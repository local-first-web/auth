import { Action, SignatureChain } from '@/chain'

export const deserialize = <A extends Action>(serialized: string): SignatureChain<A> => {
  return JSON.parse(serialized) as SignatureChain<A>
}
