import { Action, SignatureChain } from '@/chain'

export const serialize = <A extends Action>(chain: SignatureChain<A>) => {
  return JSON.stringify(chain)
}
