import { Action, getPredecessors, SignatureChain } from '@/chain'
import { arrayToMap, assert, debug, Hash } from '@/util'
import { TruncatedHashFilter } from './TruncatedHashFilter'
import { SyncPayload, SyncState } from './types'

const log = debug('lf:auth:sync')

export const generateMessage = <A extends Action>(
  prevChain: SignatureChain<A>,
  prevSyncState: SyncState
): [SyncState, SyncPayload<A> | undefined] => {
  const { theirHead, commonHead, ourNeed, theirNeed } = prevSyncState
  const { root, head } = prevChain
  const ourHead = head

  if (commonHead === ourHead) {
    // already synced up
    log('generateMessage: already synced up %o', { ourHead, theirHead })
    return [prevSyncState, undefined]
  }

  const syncState = { ...prevSyncState, ourHead }
  const syncMessage: SyncPayload<A> = { root, head }

  const weHaveConverged = theirHead === ourHead
  const theyAreBehind = theirHead && theirHead in prevChain.links

  if (weHaveConverged) {
    // we converged with the last message we received
    // (we still want to send them a final message so they know we're done)
    syncState.commonHead = ourHead
  } else if (theyAreBehind) {
    // we are ahead of them , so we know exactly what they need

    // they already have everything preceding their head
    assert(theirHead)
    const predecessorHashes = getPredecessors(prevChain, prevChain.links[theirHead]).map(
      link => link.hash
    )
    const theyAlreadyHave = [
      ...predecessorHashes,
      theirHead, // also the head itself
    ]

    // send them everything we have that they don't already have
    syncMessage.links = Object.keys(prevChain.links)
      .filter(hash => !theyAlreadyHave.includes(hash))
      .map(hash => prevChain.links[hash])
      .reduce(arrayToMap('hash'), {})
  } else {
    // we have divergent chains

    // build a probabilistic filter representing the hashes we think they may need
    const syncedLinks = commonHead
      ? getPredecessors(prevChain, prevChain.links[commonHead]) // we'll omit everything they already have
      : []
    const syncedHashes = syncedLinks.map(link => link.hash)
    const hashesTheyMightNeed = Object.keys(prevChain.links)
      .filter(hash => hash !== commonHead) // omit last common head
      .filter(hash => !syncedHashes.includes(hash)) // and its predecessors

    // TODO: we already have hashes - make TruncatedHashFilter compatible with base64
    const filter = new TruncatedHashFilter().add(hashesTheyMightNeed)
    syncMessage.encodedFilter = filter.save() // send compact representation of the filter

    // send them any links we know they need
    syncMessage.links = theirNeed
      .map(hash => prevChain.links[hash]) // look up each link
      .reduce(arrayToMap('hash'), {}) // put links in a map

    // our missing dependencies
    syncMessage.need = ourNeed
  }

  log('generateMessage %o', { syncState: prevSyncState, syncMessage })
  return [syncState, syncMessage]
}
