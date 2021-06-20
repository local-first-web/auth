import { Action, LinkMap } from '@/chain'
import { Hash } from '@/util'

export type EncodedFilter = Uint8Array // the encoded output of a probabilistic filter

export interface SyncState {
  /** The head we had in common with this peer the last time we synced. If null, we don't have any
   * record of having synced before. */
  commonHead: Hash | null

  /** Our head as of the last time we sent a sync message */
  ourHead: Hash | null

  ourNeed: Hash[]

  /** Their head as of the last time they sent a sync message */
  theirHead: Hash | null

  /** Links they said they needed in their most recent sync message */
  theirNeed: Hash[]

  /** All the links we believe they have */
  theirHave: Hash[]

  /** All the links we've sent them */
  sentLinks: Hash[]
}

export interface SyncPayload<A extends Action> {
  /** Our root. We just send this as a sanity check - if our roots don't match we can't sync. */
  root: Hash

  /** Our head at the time of sending. */
  head: Hash

  /** Any links we know they need. */
  links?: LinkMap<A>

  /** Any hashes we know we need. */
  need?: Hash[]

  /** A byte-array encoding of a probabilistic filter representing the hashes we have  */
  encodedFilter?: EncodedFilter
}
