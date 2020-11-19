import { clone } from './clone'
import { hashLink } from './hashLink'
import { isPredecessor } from './predecessors'
import { Action, MergeLink, SignatureChain } from './types'
import { Hash } from '/util'

export const merge = <A extends Action>(
  a: SignatureChain<A>,
  b: SignatureChain<A>
): SignatureChain<A> => {
  if (a.root !== b.root) throw new Error('Cannot merge two chains with different roots')

  if (a.head === b.head) return clone(a) // they're the same

  if (isPredecessor(a, a.links[b.head], a.links[a.head])) return clone(a) // a is ahead of b; fast forward
  if (isPredecessor(b, b.links[a.head], b.links[b.head])) return clone(b) // b is ahead of a; fast forward

  // create a new map containing all links from both chains
  const links = { ...a.links, ...b.links }

  const root = a.root

  const mergeLink = createMergeLink(a.head, b.head)

  // add this link as the new head
  const head = mergeLink.hash
  links[mergeLink.hash] = mergeLink

  return { root, head, links }
}

/** Returns a merge link, which has no content other than a pointer to each of the two heads */
export const createMergeLink = (a: Hash, b: Hash) => {
  const body = [a, b].sort() // ensure deterministic order
  const hash = hashLink(body)
  return { type: 'MERGE', hash, body } as MergeLink
}
