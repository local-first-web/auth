import { clone } from '@/util'
import { hashLink } from '@/chain/hashLink'
import { isPredecessor } from '@/chain/predecessors'
import { Action, MergeLink, SignatureChain } from '@/chain/types'
import { Hash } from '@/util'
import { getLength } from './getLength'
import { getHead } from './getHead'

export const merge = <A extends Action>(
  a: SignatureChain<A>,
  b: SignatureChain<A>
): SignatureChain<A> => {
  if (a.root !== b.root) throw new Error('Cannot merge two chains with different roots')

  const root = a.root
  const links = { ...a.links, ...b.links }

  let head: string

  if (a.head === b.head) {
    // they're the same
    head = a.head
  } else if (b.head in a.links && isPredecessor(a, a.links[b.head], getHead(a))) {
    // a is ahead of b; fast forward
    head = a.head
  } else if (a.head in b.links && isPredecessor(b, b.links[a.head], getHead(b))) {
    // b is ahead of a; fast forward
    head = b.head
  } else {
    const mergeLink = createMergeLink(a.head, b.head)

    // add this link as the new head
    head = mergeLink.hash

    links[mergeLink.hash] = mergeLink
  }
  const merged: SignatureChain<A> = { root, head, links }

  // console.log(`merge: a=${getLength(a)}, b=${getLength(b)}, merged=${getLength(merged)} `)

  return merged
}

/** Returns a merge link, which has no content other than a pointer to each of the two heads */
export const createMergeLink = (a: Hash, b: Hash) => {
  const body = [a, b].sort() // ensure deterministic order
  const hash = hashLink(body)
  return { type: 'MERGE', hash, body } as MergeLink
}
