import { append } from '@/chain/append'
import { Action, ROOT, SignatureChain } from '@/chain/types'
import { LocalUserContext } from '@/context'

export const EMPTY_CHAIN = {
  root: null,
  head: null,
  links: {},
}

export const create = <A extends Action>(payload: any = {}, context: LocalUserContext) => {
  const link = { type: ROOT, payload }
  return append(EMPTY_CHAIN, link, context) as SignatureChain<A>
}
