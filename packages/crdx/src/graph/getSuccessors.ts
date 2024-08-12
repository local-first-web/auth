﻿import { memoize } from '@localfirst/shared'
import { uniq } from 'lodash-es'
import { type Hash } from 'util/index.js'
import { getChildrenHashes } from './children.js'
import type { Action, Graph, Link } from './types.js'

const memoizeResolver = (graph: Graph<any, any>, hash: Hash) => `${graph.head.join('')}:${hash}`

export const getSuccessorHashes = memoize((graph: Graph<any, any>, hash: Hash): Hash[] => {
  var children = [ ...getChildrenHashes(graph, hash) ]
  let visited = new Set()

  while (children.length > 0) {
    var child = children.pop()

    if (!visited.has(child)) {
      visited.add(child)
      for (const successor of getChildrenHashes(graph, child)) {
        children.push(successor)
      }
    }
  }

  return Array.from(visited)
}, memoizeResolver)

/** Returns the set of successors of `link` (not including `link`) */
export const getSuccessors = <A extends Action, C>(
  graph: Graph<A, C>,
  link: Link<A, C>
): Array<Link<A, C>> =>
  getSuccessorHashes(graph, link.hash)
    .map(h => graph.links[h])
    .filter(link => link !== undefined)
