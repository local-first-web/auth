import { Action, getPredecessors, SignatureChain } from '@/chain'
import { arrayToMap, assert, debug, Hash } from '@/util'
import { TruncatedHashFilter } from './TruncatedHashFilter'
import { SyncPayload, SyncState } from './types'

const log = debug('lf:auth:sync')

export const generateMessage = <A extends Action>(
  chain: SignatureChain<A>,
  syncState: SyncState
): [SyncState, SyncPayload<A> | undefined] => {
  const { theirHead, commonHead, ourNeed, theirNeed } = syncState
  const { root, head } = chain
  const ourHead = head

  if (commonHead === ourHead) {
    // already synced up
    log('generateMessage: already synced up %o', { ourHead, theirHead })
    return [syncState, undefined]
  }

  const newSyncState = { ...syncState, ourHead }
  const syncMessage: SyncPayload<A> = { root, head }

  const weHaveConverged = theirHead === ourHead
  const theyAreBehind = theirHead && theirHead in chain.links

  if (weHaveConverged) {
    // we converged with the last message we received
    // (we still want to send them a final message so they know we're done)
    newSyncState.commonHead = ourHead
  } else if (theyAreBehind) {
    // their head precedes ours, so we know exactly what they need

    // they already have everything preceding their head
    assert(theirHead)
    const predecessorHashes = getPredecessors(chain, chain.links[theirHead]).map(link => link.hash)
    const theyAlreadyHave = [
      ...predecessorHashes,
      theirHead, // also the head itself
    ]

    // send them everything we have that they don't already have
    syncMessage.links = Object.keys(chain.links)
      .filter(hash => !theyAlreadyHave.includes(hash))
      .map(hash => chain.links[hash])
      .reduce(arrayToMap('hash'), {})
  } else {
    // we have divergent chains

    // build a probabilistic filter representing the hashes we think they may need
    const syncedLinks = commonHead ? getPredecessors(chain, chain.links[commonHead]) : []
    const syncedHashes = syncedLinks.map(link => link.hash)
    const haveHashes = Object.keys(chain.links).filter(
      hash =>
        hash !== commonHead && // omit last common head
        !syncedHashes.includes(hash) // and its predecessors
    )
    // TODO: we already have hashes - make TruncatedHashFilter compatible with base64
    const filter = new TruncatedHashFilter().add(haveHashes)
    syncMessage.encodedFilter = filter.save() // send compact representation of the filter

    // send them any links we know they need
    syncMessage.links = theirNeed
      .map(hash => chain.links[hash]) // look up each link
      .reduce(arrayToMap('hash'), {}) // put links in a map

    // our missing dependencies
    syncMessage.need = ourNeed
  }

  log('generateMessage %o', { syncState, syncMessage })
  return [newSyncState, syncMessage]
}
