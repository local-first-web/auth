import { uniq } from 'lodash-es'
import { getChildrenHashes } from './children.js'
import { type Action, type Link, type Graph } from './types.js'
import { type Hash, memoize } from 'util/index.js'

export const getSuccessorHashes = memoize((graph: Graph<any, any>, hash: Hash): Hash[] => {
  const children = getChildrenHashes(graph, hash)
  const successors = children.flatMap(parent => getSuccessorHashes(graph, parent))
  return uniq(children.concat(successors))
})

/** Returns the set of successors of `link` (not including `link`) */
export const getSuccessors = <A extends Action, C>(
  graph: Graph<A, C>,
  link: Link<A, C>
): Array<Link<A, C>> =>
  getSuccessorHashes(graph, link.hash)
    .map(h => graph.links[h])
    .filter(link => link !== undefined)

export const isSuccessorHash = (graph: Graph<any, any>, a: Hash, b: Hash) =>
  getSuccessorHashes(graph, b).includes(a)

/** Returns true if `a` is a successor of `b` */
export const isSuccessor = <A extends Action, C>(
  graph: Graph<A, C>,
  a: Link<A, C>,
  b: Link<A, C>
): boolean => {
  return (
    a !== undefined &&
    b !== undefined &&
    a.hash in graph.links &&
    b.hash in graph.links &&
    getSuccessorHashes(graph, b.hash).includes(a.hash)
  )
}
