import { Link, Action, SignatureChain } from '@/chain/types'

export const getHead = <A extends Action>(chain: SignatureChain<A>): Link<A> =>
  chain.links[chain.head]! as Link<A>
