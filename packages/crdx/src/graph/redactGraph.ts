import { getChildMap } from './getParentMap.js'
import type { Action, EncryptedGraph, Graph } from './types.js'

export const redactGraph = <A extends Action, C>(graph: Graph<A, C>): EncryptedGraph => {
  const { head, root, encryptedLinks } = graph
  const childMap = getChildMap(graph)
  return {
    head,
    root,
    encryptedLinks,
    childMap,
  }
}
