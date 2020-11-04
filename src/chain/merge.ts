import { clone } from './clone'
import { hashLink } from './hashLink'
import { LinkBody, MergeLink, SignatureChain } from './types'

export const merge = <T extends LinkBody>(
  a: SignatureChain<T>,
  b: SignatureChain<T>
): SignatureChain<T> => {
  if (a.root !== b.root) throw new Error('Cannot merge two chains with different roots')

  if (a.head === b.head) return clone(a) // they're the same
  if (b.head in a.links) return clone(a) // a is ahead of b; fast forward
  if (a.head in b.links) return clone(b) // b is ahead of a; fast forward

  // create a new map containing all links from both chains
  const links = { ...a.links, ...b.links }

  const root = a.root

  // create a merge link, which is just a pointer to each of the two heads
  const body = [a.head, b.head].sort() // ensure deterministic order
  const hash = hashLink(body)
  const mergeLink = { type: 'MERGE', hash, body } as MergeLink

  // add this link as the new head
  const head = hash
  links[hash] = mergeLink
  return { root, head, links }
}
