import { assert, debug, Hash, truncateHashes } from '@/util'
import { unique } from '@/util/unique'
import { Action, getMissingLinks, merge, SignatureChain } from 'crdx'
import { TruncatedHashFilter } from './TruncatedHashFilter'
import { SyncPayload, SyncState } from './types'

const log = debug('lf:auth:sync')

export const receiveMessage = <A extends Action, C>(
  chain: SignatureChain<A, C>,
  state: SyncState,
  message: SyncPayload<A, C>
): [SignatureChain<A, C>, SyncState] => {
  const {
    root: theirRoot, //
    head: theirHead,
    links: newLinks = {},
    need = [],
    encodedFilter,
  } = message

  assert(chain.root === theirRoot, `Can't sync chains with different roots`)

  // 1. What did they send? Do we need anything else?

  const newHashes = Object.keys(newLinks)
  state.theyHaveSent = unique(state.theyHaveSent.concat(newHashes))

  // store the new links in state, in case we can't merge yet
  state.pendingLinks = { ...state.pendingLinks, ...newLinks }

  const theirChain = {
    root: theirRoot,
    head: theirHead,
    links: { ...chain.links, ...state.pendingLinks },
  }

  // check if we have links with missing dependencies
  const missingLinks = getMissingLinks(theirChain)

  // if we have everything we need, reconstruct their chain and merge with it
  if (!missingLinks.length) {
    state.pendingLinks = {} // we've used all the pending links, clear that out
    chain = merge(chain, theirChain)
  }

  state.ourNeed = missingLinks

  // 2. What do they need?

  if (encodedFilter?.byteLength) {
    const filter = new TruncatedHashFilter().load(encodedFilter)

    const theyMightNotHave = (hash: Hash) =>
      !(
        filter.hasHash(hash) ||
        theirRoot === hash ||
        theirHead === hash ||
        state.weHaveSent.includes(hash) ||
        state.theyHaveSent.includes(hash)
      )

    state.theirNeed = Object.keys(chain.links).filter(theyMightNotHave)
  } else {
    state.theirNeed = need
  }

  state.ourHead = chain.head
  state.theirHead = theirHead

  return [chain, state]
}
