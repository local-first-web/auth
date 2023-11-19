import { getLink } from './getLink.js'
import type { Action, Graph } from './types.js'

export const getHead = <A extends Action, C>(graph: Graph<A, C>) =>
  graph.head.map(hash => getLink(graph, hash)!)
