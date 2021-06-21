import { Action, merge, SignatureChain } from '@/chain'
import { assert, clone, debug, Hash } from '@/util'
import { getMissingLinks } from '../chain/getMissingLinks'
import { TruncatedHashFilter } from './TruncatedHashFilter'
import { SyncPayload, SyncState } from './types'
import { unique } from '../util/unique'

const log = debug('lf:auth:sync')

export const receiveMessage = <A extends Action>(
  prevChain: SignatureChain<A>,
  prevState: SyncState,
  message: SyncPayload<A>
): [SignatureChain<A>, SyncState] => {
  const {
    root: theirRoot, //
    head: theirHead,
    links: newLinks = {},
    need = [],
    encodedFilter,
  } = message

  assert(prevChain.root === theirRoot, `Can't sync chains with different roots`)

  let chain = clone(prevChain)

  const theyHaveSent = unique([...prevState.theyHaveSent, ...Object.keys(newLinks)])

  let pendingLinks = { ...prevState.pendingLinks, ...newLinks }

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
    const filter = new TruncatedHashFilter().load(encodedFilter)
    for (const hash in chain.links) {
      const theyProbablyHaveHash =
        filter.has(hash) ||
        theirRoot === hash ||
        theirHead === hash ||
        prevState.weHaveSent.includes(hash) ||
        theyHaveSent.includes(hash)
      if (!theyProbablyHaveHash) theirNeed.push(hash)
    }
  }

  const state: SyncState = {
    ...prevState,
    ourHead,
    theirHead,
    ourNeed,
    theirNeed,
    theyHaveSent,
    pendingLinks,
  }

  return [chain, state]
}
