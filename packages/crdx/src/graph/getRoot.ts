import { type Action, type Link, type Graph, type RootAction } from './types.js'

export const getRoot = <A extends Action, C>(graph: Graph<A, C>) =>
  graph.links[graph.root] as Link<RootAction, C>
