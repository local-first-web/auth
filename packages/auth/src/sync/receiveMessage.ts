import { Action, merge, SignatureChain } from '@/chain'
import { assert, clone, debug, Hash } from '@/util'
import { messageSummary } from '@/util/testing'
import * as R from 'ramda'
import { getMissingLinks } from '../chain/getMissingLinks'
import { TruncatedHashFilter } from './TruncatedHashFilter'
import { SyncPayload, SyncState } from './types'
const log = debug('lf:auth:sync')

export const receiveMessage = <A extends Action>(
  prevChain: SignatureChain<A>,
  prevSyncState: SyncState,
  syncMessage: SyncPayload<A>
): [SignatureChain<A>, SyncState] => {
  const {
    root: theirRoot, //
    head: theirHead,
    links: newLinks = {},
    need = [],
    encodedFilter,
  } = syncMessage

  assert(prevChain.root === theirRoot, `Can't sync chains with different roots`)

  let chain = clone(prevChain)

  const theyHaveSent = R.uniq([...prevSyncState.theyHaveSent, ...Object.keys(newLinks)])

  let pendingLinks = { ...prevSyncState.pendingLinks, ...newLinks }

  let ourNeed: Hash[] = []

  if (Object.keys(newLinks).length > 0) {
    const theirChain = {
      root: theirRoot,
      head: theirHead,
      links: { ...chain.links, ...pendingLinks },
    }
    ourNeed = getMissingLinks(theirChain)
    // if we have everything necessary to reconstruct their chain, merge with it
    if (ourNeed.length === 0) {
      chain = merge(prevChain, theirChain)
      pendingLinks = {}
    }
  }

  const ourHead = chain.head

  let theirNeed = need
  if (!theirNeed.length && encodedFilter && encodedFilter.byteLength) {
    log('using filter', encodedFilter.length)

    const filter = new TruncatedHashFilter().load(encodedFilter)
    for (const hash in chain.links) {
      const theyProbablyHaveHash =
        filter.has(hash) ||
        theirRoot === hash ||
        theirHead === hash ||
        prevSyncState.weHaveSent.includes(hash) ||
        theyHaveSent.includes(hash)
      if (!theyProbablyHaveHash) theirNeed.push(hash)
    }
  }

  const syncState: SyncState = {
    ...prevSyncState,
    ourHead,
    theirHead,
    ourNeed,
    theirNeed,
    theyHaveSent,
    pendingLinks,
  }

  // log('receiveMessage %o', syncState)
  return [chain, syncState]
}
