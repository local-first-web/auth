import { Action, getParentHashes, LinkMap, merge, SignatureChain } from '@/chain'
import { assert, debug, Hash } from '@/util'
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
    links,
    encodedFilter,
  } = syncMessage

  const {
    root: ourRoot, //
    head: ourHead,
  } = prevChain

  assert(ourRoot === theirRoot, `Can't sync chains with different roots`)

  let chain = prevChain
  const syncState: SyncState = {
    ...prevSyncState,
    ourHead,
    theirHead,
  }

  // if they've sent us links, record them; if we're missing any dependencies, note them to ask for them next time
  if (links) {
    chain.links = { ...prevChain.links, ...links } as LinkMap<A>

    const theirChain = { root: theirRoot, head: theirHead, links: chain.links }

    const parentHashes = Object.values(links) //
      .flatMap(link => getParentHashes(theirChain, link))
      .concat(theirHead)
    const ourNeed = parentHashes.filter(hash => !(hash in chain.links))

    // if we're not missing anything, merge with their chain
    if (ourNeed.length === 0) {
      chain = merge(prevChain, theirChain)
      syncState.ourHead = chain.head
    }

    syncState.ourNeed = ourNeed
  }

  // if they've sent us a filter, run all our links through it to know what they have and what they need
  if (encodedFilter) {
    const theirNeed = new Set<Hash>()
    const theirHave = new Set<Hash>(prevSyncState.theirHave)
    const filter = new TruncatedHashFilter().load(encodedFilter)
    for (const hash in prevChain.links) {
      if (filter.has(hash) || theirRoot === hash || theirHead === hash) {
        theirHave.add(hash)
      } else {
        theirNeed.add(hash)
      }
    }
    syncState.theirNeed = Array.from(theirNeed)
    syncState.theirHave = Array.from(theirHave)
  }

  log('receiveMessage %o', { syncState, chain })
  return [chain, syncState]
}
