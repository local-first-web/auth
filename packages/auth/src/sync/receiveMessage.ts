import { Action, merge, SignatureChain } from '@/chain'
import { assert, clone, Hash } from '@/util'
import { getMissingLinks } from '../chain/getMissingLinks'
import { unique } from '../util/unique'
import { TruncatedHashFilter } from './TruncatedHashFilter'
import { SyncPayload, SyncState } from './types'

export const receiveMessage = <A extends Action>(
  chain: SignatureChain<A>,
  state: SyncState,
  message: SyncPayload<A>
): [SignatureChain<A>, SyncState] => {
  const {
    root: theirRoot, //
    head: theirHead,
    links: newLinks = {},
    need = [],
    encodedFilter,
  } = message

  assert(chain.root === theirRoot, `Can't sync chains with different roots`)

  // 1. What did they send? Do we need anything else?

  const theySentLinks = Object.keys(newLinks).length > 0
  if (theySentLinks) {
    state.theyHaveSent = unique(state.theyHaveSent.concat(Object.keys(newLinks)))

    // store the new links in state, in case we can't merge yet
    state.pendingLinks = { ...state.pendingLinks, ...newLinks }

    const theirChain = {
      root: theirRoot,
      head: theirHead,
      links: { ...chain.links, ...state.pendingLinks },
    }

    // check if we have links with missing dependencies
    const missingLinks = getMissingLinks(theirChain)

    // if we have everything necessary to reconstruct their chain and merge with it
    if (!missingLinks.length) {
      state.pendingLinks = {} // we've used all the pending links, clear that out
      chain = merge(chain, theirChain)
    }

    state.ourNeed = missingLinks
  } else {
    // they didn't send links, so we can't say if we need anything new
    state.ourNeed = []
  }

  // 2. What do they need?

  if (!need.length && encodedFilter?.byteLength) {
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
