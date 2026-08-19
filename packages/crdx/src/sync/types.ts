import { type EncryptedLink, type LinkMap } from '../graph/index.js'
import { type Hash } from '../util/index.js'
import { type ValidationError } from '../validator/index.js'

export type SyncState = {
  their: {
    /** Their head as of the last time they sent a sync message. */
    head: Hash[]

    /** Links they've sent that we haven't added yet (e.g. because we're missing dependencies). */
    encryptedLinks: Record<Hash, EncryptedLink>

    /** The map of hashes they've sent to those links' parents. */
    parentMap: LinkMap

    /** Hashes of links they asked for in the last message. */
    need: Hash[]
  }

  our: {
    /** Our head as of the last message */
    head: Hash[]

    /** The last error we sent them */
    reportedError?: ValidationError

    /** Our head when we sent the last linkMap, so we don't keep sending it */
    parentMapAtHead?: Hash[]

    /** List of links we've sent them, so we don't send them multiple times */
    links: Hash[]
  }

  /** The head we had in common with this peer the last time we synced. If empty, we haven't synced before. */
  lastCommonHead: Hash[]

  /**
   * We increment this each time we refuse a merge because we would have ended up with a graph we
   * couldn't replay — a link whose bytes don't match its hash, a `prev` naming a link nobody has, a
   * second ROOT. An application can read this as a reason to stop talking to a peer.
   *
   * Timestamps are not in here. See `advisoryFailureCount`.
   */
  failedSyncCount: number

  /**
   * We increment this each time a merge we accepted failed one of the advisory rules — the graph
   * replays, but its timestamps don't line up with our clock or with each other.
   *
   * This is deliberately not `failedSyncCount` and deliberately not sent back to the peer. Nothing
   * was refused, so calling it a failed sync would be false; and clock disagreement between honest
   * peers is routine, so feeding it to the counter an application uses to decide whom to trust
   * would punish a peer for an NTP step. What it is good for is telling someone their clock is
   * wrong. See `advisoryValidators`.
   */
  advisoryFailureCount: number

  /** The most recent advisory failure, if any, for an application that wants to surface it. */
  lastAdvisoryError?: ValidationError
}

export type SyncMessage = {
  /** Our root. We just send this as a sanity check - if our roots don't match we can't sync. */
  root: Hash

  /** Our head at the time of sending. */
  head: Hash[]

  /** Any links we know we need. */
  links?: Record<Hash, EncryptedLink>

  /** Our most recent hashes and their dependencies. */
  parentMap?: LinkMap

  /** Any hashes we know we need. */
  need?: Hash[]

  /** Any errors caused by their last sync message. */
  error?: ValidationError
}
