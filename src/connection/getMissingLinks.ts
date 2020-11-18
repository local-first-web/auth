import { BloomFilter } from 'bloomfilter'
import * as R from 'ramda'
import { SignatureChain } from '/chain'
import { isPredecessor } from '/chain/predecessors'
import { getSuccessors } from '/chain/successors'
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
