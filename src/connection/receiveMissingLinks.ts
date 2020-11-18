import { createMergeLink, getParentHashes, isPredecessor, SignatureChain } from '/chain'
import { TeamLink, TeamLinkMap } from '/team'
import { Hash } from '/util'

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
