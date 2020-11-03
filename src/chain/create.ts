import { append } from './append'
import { NodeBody, SignatureChain } from './types'
import { LocalUserContext } from '/context'

export const EMPTY_CHAIN = {
  root: null,
  head: null,
  nodes: new Map(),
}

export const create = <T extends NodeBody>(payload: any = {}, context: LocalUserContext) => {
  const node = { type: 'ROOT', payload }
  return append(EMPTY_CHAIN, node, context) as SignatureChain<T>
}
