import { append } from './append'
import { SignatureGraph } from './types'
import { LocalUserContext } from '/context'

export const EMPTY_GRAPH = {
  root: null,
  head: null,
  nodes: new Map(),
}

export const create = (payload: any = {}, context: LocalUserContext) => {
  const node = { type: 'ROOT', payload }
  return append(EMPTY_GRAPH, node, context) as SignatureGraph
}
