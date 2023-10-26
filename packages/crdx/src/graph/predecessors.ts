import uniq from 'lodash/uniq'
import { getLink } from './graph.js'
import { type Action, type Graph, type Link } from './types.js'
import { type Hash, memoize } from 'util/index.js'

export const getPredecessorHashes = memoize((graph: Graph<any, any>, hash: Hash): Hash[] => {
  const parents = (getLink(graph, hash)?.body.prev ?? []) as Hash[]
  const predecessors = parents.flatMap(parent => getPredecessorHashes(graph, parent))
  return uniq(parents.concat(predecessors))
})

/** Returns the set of predecessors of `link` (not including `link`) */
export const getPredecessors = <A extends Action, C>(
  graph: Graph<A, C>,
  link: Link<A, C>
): Array<Link<A, C>> =>
  getPredecessorHashes(graph, link.hash)
    .map(h => graph.links[h])
    .filter(link => link !== undefined)

/** Returns true if `a` is a predecessor of `b` */
export const isPredecessorHash = (graph: Graph<any, any>, a: Hash, b: Hash) =>
  getPredecessorHashes(graph, b).includes(a)

/** Returns true if `a` is a predecessor of `b` */
export const isPredecessor = (graph: Graph<any, any>, a: Link<any, any>, b: Link<any, any>) => {
  return (
    a !== undefined &&
    b !== undefined &&
    a.hash in graph.links &&
    b.hash in graph.links &&
    getPredecessorHashes(graph, b.hash).includes(a.hash)
  )
}
