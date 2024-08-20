import { memoize } from '@localfirst/shared'
import { type Hash } from 'util/index.js'
import { getLink } from './getLink.js'
import { getPredecessorHashes } from './getPredecessors.js'
import { getChildrenHashes } from './children.js'
import type { Action, Graph, Link } from './types.js'

/** Returns all links that are concurrent with the given link. */
export const getConcurrentLinks = <A extends Action, C>(
  graph: Graph<A, C>,
  link: Link<A, C>
): Array<Link<A, C>> => {
  return getConcurrentHashes(graph, link.hash).map(hash => getLink(graph, hash))
}

export const getConcurrentHashes = (graph: Graph<any, any>, hash: Hash): Hash[] => {
  const concurrencyLookup = calculateConcurrency(graph)
  return concurrencyLookup[hash]
}

/**
 * Creates a lookup (by hash) containing the hashes of all links that are concurrent with the
 * corresponding link.
 *  ```
 * {
 *    hash: [childHash, childHash, ...],
 *    hash: [childHash, childHash, ...],
 * }
 * ```
 */
export const calculateConcurrency = memoize(<A extends Action, C>(graph: Graph<A, C>) => {
  const toVisit = [graph.root]
  const visited: Set<Hash> = new Set()
  const concurrencyLookup: Record<Hash, Hash[]> = {}

  while (toVisit.length > 0) {
    const current = toVisit.shift() as Hash

    if (visited.has(current)) {
      continue
    }

    const predecessors = new Set(getPredecessorHashes(graph, current))
    const concurrent: Hash[] = []

    for (const v of Array.from(visited)) {
      if (!predecessors.has(v) && !getPredecessorHashes(graph, v).includes(current)) {
        concurrent.push(v)
      }
    }

    concurrencyLookup[current] = concurrent

    for (const c of concurrent) {
      concurrencyLookup[c].push(current)
    }

    for (const c of getChildrenHashes(graph, current)) {
        toVisit.push(c)
    }
    visited.add(current)
  }

  return concurrencyLookup
})

export const getConcurrentBubbles = <A extends Action, C>(graph: Graph<A, C>): Hash[][] => {
  const seen: Record<Hash, boolean> = {}

  // returns an array containing the given hash and all hashes directly or indirectly concurrent with it
  const getBubble = (a: Hash) => {
    const bubble = [a]
    for (const b of getConcurrentHashes(graph, a))
      if (!seen[b]) {
        seen[b] = true
        bubble.push(...getBubble(b))
      }

    return bubble
  }

  const bubbles: Hash[][] = []
  for (const _ in graph.links) {
    const hash = _ as Hash
    if (!seen[hash]) {
      seen[hash] = true
      const bubble = getBubble(hash)
      if (bubble.length > 1) {
        bubbles.push(bubble)
      }
    }
  }

  return bubbles
}
