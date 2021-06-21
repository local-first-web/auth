import { Action, getHead, getPredecessorHashes, isPredecessor, SignatureChain } from '@/chain'
import { arrayToMap, assert, debug } from '@/util'
import { messageSummary } from '@/util/testing'
import * as R from 'ramda'
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
  const theyAreBehind =
    theirNeed.length === 0 &&
    theirHead &&
    theirHead in prevChain.links &&
    isPredecessor(prevChain, prevChain.links[theirHead], getHead(prevChain))

  if (weHaveConverged) {
    // we converged with the last message we received
    // (we still want to send them a final message so theJy know we're done)
    syncState.commonHead = ourHead
  } else if (theyAreBehind) {
    // we are ahead of them , so we know exactly what they need

    // they already have their head and everything preceding it
    assert(theirHead)
    const theyAlreadyHave = [
      ...getPredecessorHashes(prevChain, theirHead),
      theirHead, // also the head itself
    ]

    // send them everything we have that they don't already have
    syncMessage.links = Object.keys(prevChain.links)
      .filter(hash => !theyAlreadyHave.includes(hash)) // exclude what they have
      .filter(hash => !syncState.weHaveSent.includes(hash)) // exclude what we've already sent
      .map(hash => prevChain.links[hash]) // look up the link
      .reduce(arrayToMap('hash'), {}) // turn into map
  } else {
    // we have divergent chains

    // build a probabilistic filter representing the hashes we think they may need
    const alreadySynced = commonHead
      ? getPredecessorHashes(prevChain, commonHead) // omit what they already have
      : []
    const hashesTheyMightNeed = Object.keys(prevChain.links)
      .filter(hash => hash !== commonHead) // omit last common head
      .filter(hash => !alreadySynced.includes(hash)) // and its predecessors

    // TODO: we already have hashes - make TruncatedHashFilter compatible with base64
    const filter = new TruncatedHashFilter().add(hashesTheyMightNeed)
    syncMessage.encodedFilter = filter.save() // send compact representation of the filter

    // send them any links we know they need
    syncMessage.links = theirNeed
      .map(hash => prevChain.links[hash]) // look up each link
      .reduce(arrayToMap('hash'), {}) // put links in a map

    syncState.theirNeed = []

    // our missing dependencies
    syncMessage.need = ourNeed
  }

  syncState.weHaveSent = R.uniq([...syncState.weHaveSent, ...Object.keys(syncMessage.links ?? {})])

  log('generateMessage %o', messageSummary(syncMessage))

  return [syncState, syncMessage]
}
