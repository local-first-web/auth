import * as chains from '@/chain'
import { Action, SignatureChain, getPredecessors, TeamSignatureChain } from '@/chain'
import { Hash } from '@/util'
import { SyncState, SyncPayload } from './types'
import { TruncatedHashFilter } from './TruncatedHashFilter'

export * from './types'

export const generateMessage = <A extends Action>(
  chain: SignatureChain<A>,
  syncState: SyncState
): [SyncState, SyncPayload<A>] => {
  // const { commonHead, theirNeed } = syncState
  const { root, head } = chain

  const newSyncState = {
    ...syncState,
    ourHead: chain.head,
  }

  const need = [] as Hash[] // missing dependencies

  // build a filter representing the links we have that they might not have

  // omit links that we know we've already synced
  // const syncedLinks = commonHead ? getPredecessors(chain, chain.links[commonHead]) : []
  // const syncedHashes = syncedLinks.map(link => link.hash)
  // const haveLinks = Object.values(chain.links).filter(
  //   link =>
  //     link.hash !== chain.root && // listed separately, don't need to repeat
  //     link.hash !== chain.head && // listed separately, don't need to repeat
  //     link.hash !== commonHead && // omit last common head
  //     // !syncedHashes.includes(link.hash) // and its predecessors
  // )
  // const haveHashes: Hash[] = [] //haveLinks.map(l => l.hash)

  // build a probabilistic filter representing the hashes we think they may need
  // const haveFilter = new TruncatedHashFilter().addHashes(haveHashes)

  // what we send is a compact representation of the filter
  const have = new Uint8Array() // haveFilter.save()

  // send them any links they've explicitly asked for
  // const links = theirNeed.map(hash => chain.links[hash])
  // TODO: if their head precedes ours, just send them the links we know they need and no filter

  // temporarily just sending all of our links
  const links = chain.links

  const syncMessage: SyncPayload<A> = { root, head, links, have, need }
  return [newSyncState, syncMessage]
}

export const receiveMessage = <A extends Action>(
  chain: SignatureChain<A>,
  syncState: SyncState,
  syncMessage: SyncPayload<A>
): [SignatureChain<A>, SyncState] => {
  const { root, head, links } = syncMessage
  const theirChain = { root, head, links } as SignatureChain<A>
  const newChain = chains.merge(chain, theirChain)
  return [newChain, syncState]
}

export const initSyncState = (): SyncState => ({
  commonHead: null,
  ourHead: null,
  theirHead: null,
  theirNeed: [],
  theirHave: new Set(),
  sentLinks: new Set(),
})
