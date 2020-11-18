import { BloomFilter } from 'bloomfilter'
import * as R from 'ramda'
import { createMergeLink, getParentHashes, SignatureChain } from '/chain'
import { isPredecessor } from '/chain/predecessors'
import { getSuccessors } from '/chain/successors'
import { TeamLink, TeamLinkMap } from '/team'
import { Hash } from '/util'

export const getMissingLinks = (
  chain: SignatureChain<any>,
  theirHead: Hash,
  theirFilter: BloomFilter
) => {
  const { links, head } = chain
  const hashes = Object.keys(links)

  const weHaveTheSameHead = theirHead === head
  const theirHeadIsBehindOurs =
    theirHead in links && isPredecessor(chain, links[theirHead], links[head])

  // if we have the same head,
  if (weHaveTheSameHead) {
    // there are no missing links
    return []
  }

  // if their head is a predecessor of our head,
  else if (theirHeadIsBehindOurs) {
    // send them all the successors of their head
    return getSuccessors(chain, links[theirHead])
  }

  // otherwise we have divergent chains;
  else {
    // use the Bloom filter they sent to figure out which links they're missing
    const missingLinks = hashes
      .filter(hash => theirFilter.test(hash) === false)
      .map(hash => links[hash])

    // also include the successors of any links they're missing
    const successors = missingLinks.flatMap(link => getSuccessors(chain, link))

    // deduplicate the list
    return R.uniq(missingLinks.concat(successors))
  }
}

export const receiveMissingLinks = (
  ourChain: SignatureChain<any>,
  theirHead: Hash,
  theirLinks: TeamLink[]
) => {
  const allLinks = {
    // all our links
    ...ourChain.links,
    // all their new links, as a hashmap
    ...theirLinks.reduce((r, c) => ({ ...r, [c.hash]: c }), {}),
  } as TeamLinkMap

  // make sure we're not missing any links that are referenced by these new links
  const parentHashes = theirLinks.flatMap(link => getParentHashes(ourChain, link))
  const missingHashes = parentHashes.filter(hash => !(hash in allLinks))
  if (missingHashes.length > 0) return { success: false, missingHashes }

  // we have everything we need
  // add the new links to our chain
  ourChain.links = allLinks

  const ourHeadWasBehindTheirs = isPredecessor(
    ourChain,
    allLinks[ourChain.head],
    allLinks[theirHead]
  )

  if (ourHeadWasBehindTheirs) {
    // we were behind them - fast forward
    ourChain.head = theirHead
  } else {
    // we had diverged - create a merge link
    const mergeLink = createMergeLink(ourChain.head, theirHead)

    ourChain.links[mergeLink.hash] = mergeLink
    ourChain.head = mergeLink.hash
  }

  return { success: true }
}

export const getFilter = (chain: SignatureChain<any>) => {
  const filter = new BloomFilter(
    // TODO: Can we be smart about these parameters?
    32 * 256,
    16 // number of hash functions.
  )
  for (const hash in chain.links) filter.add(hash)
  return filter
}
