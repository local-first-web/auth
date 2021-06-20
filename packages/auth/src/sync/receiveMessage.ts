import { Action, Link, LinkMap, merge, SignatureChain } from '@/chain'
import { assert, debug, Hash } from '@/util'
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
    links: newLinks = [],
    encodedFilter,
  } = syncMessage

  assert(prevChain.root === theirRoot, `Can't sync chains with different roots`)

  let chain = { ...prevChain }
  // record any links ; if we're missing any dependencies, note them to ask for them next time
  chain.links = { ...prevChain.links, ...newLinks } as LinkMap<A>

  const theirChain = { ...chain, head: theirHead }
  const ourNeed = getMissingLinks(theirChain)

  // if we're not missing anything, merge with their chain
  if (newLinks && ourNeed.length === 0) {
    // console.log({ prevChain, theirChain })
    chain = merge(prevChain, theirChain)
  }
  const ourHead = chain.head

  // if they've sent us a filter, run all our links through it to know what they have and what they need
  const [theirNeed, theirHave] = checkLinksAgainstFilter(prevChain, prevSyncState, encodedFilter)

  const syncState: SyncState = {
    ...prevSyncState,
    ourHead,
    theirHead,
    ourNeed,
    theirNeed,
    theirHave,
  }

  log('receiveMessage %o', { syncState, chain })
  return [chain, syncState]
}

const checkLinksAgainstFilter = <A extends Action>(
  chain: SignatureChain<A>,
  syncState: SyncState,
  encodedFilter: Uint8Array | undefined
) => {
  if (encodedFilter === undefined || encodedFilter.length === 0) return [[], syncState.theirHave]
  const theirNeed = new Set<Hash>()
  const theirHave = new Set<Hash>(syncState.theirHave)
  const filter = new TruncatedHashFilter().load(encodedFilter)
  for (const hash in chain.links) {
    if (filter.has(hash) || chain.root === hash || syncState.theirHead === hash) {
      theirHave.add(hash)
    } else {
      theirNeed.add(hash)
    }
  }
  return [Array.from(theirNeed), Array.from(theirHave)]
}
