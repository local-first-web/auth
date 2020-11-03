import { append } from './append'
import { LinkBody, ROOT, SignatureChain } from './types'
import { LocalUserContext } from '/context'

export const EMPTY_CHAIN = {
  root: null,
  head: null,
  links: {},
}

export const create = <T extends LinkBody>(payload: any = {}, context: LocalUserContext) => {
  const link = { type: ROOT, payload }
  return append(EMPTY_CHAIN, link, context) as SignatureChain<T>
}
