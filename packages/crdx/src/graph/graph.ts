import { type Action, type Link, type Graph, type RootAction } from './types.js'
import { type Hash } from 'util/index.js'

export const getRoot = <A extends Action, C>(graph: Graph<A, C>) =>
  graph.links[graph.root] as Link<RootAction, C>

export const getHead = <A extends Action, C>(graph: Graph<A, C>) =>
  graph.head.map(hash => getLink(graph, hash)!)

export const getHashes = (graph: Graph<any, any>) => Object.keys(graph.links) as Hash[]

export const getLink = <A extends Action, C>(graph: Graph<A, C>, hash: Hash): Link<A, C> =>
  graph.links[hash]

export const getEncryptedLink = (graph: Graph<any, any>, hash: Hash) => graph.encryptedLinks[hash]

export const getEncryptedLinks = (graph: Graph<any, any>, hashes: Hash[]) =>
  Object.fromEntries(hashes.map(hash => [hash, getEncryptedLink(graph, hash)]))

export function getParents<A extends Action, C>(
  graph: Graph<A, C>,
  link: Link<A, C>
): Array<Link<A, C>>
export function getParents(graph: Graph<any, any>, hash: Hash): Hash[]
export function getParents<A extends Action, C>(graph: Graph<A, C>, linkOrHash: Link<A, C> | Hash) {
  if (typeof linkOrHash === 'string') {
    const hash: Hash = linkOrHash
    const link = getLink(graph, hash)
    return link.body.prev
  }

  const link: Link<A, C> = linkOrHash
  return link.body.prev.map(hash => getLink(graph, hash))
}
