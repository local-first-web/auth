import { assert } from '@localfirst/shared'
import { decryptGraph, type DecryptFn } from '../graph/decrypt.js'
import { getChildMap, invertLinkMap, merge, type Action, type Graph } from '../graph/index.js'
import { createKeyring, type Keyring, type KeysetWithSecrets } from '../keyset/index.js'
import { validate, validateStructure } from '../validator/index.js'
import { type SyncMessage, type SyncState } from './types.js'

/**
 * Receives a sync message from a peer and updates our sync state accordingly so that
 * `generateMessage` can determine what information they need. Also possibly updates our graph with
 * information from them.
 *
 * @returns A tuple `[graph, state]` containing our updated graph and our updated sync state with
 * this peer.
 * */
export const receiveMessage = <A extends Action, C>(
  /** Our current graph */
  graph: Graph<A, C>,

  /** Our sync state with this peer */
  prevState: SyncState,

  /** The sync message they've just sent */
  message: SyncMessage,

  keys: KeysetWithSecrets | Keyring,

  decrypt: DecryptFn<A, C> = decryptGraph
): [Graph<A, C>, SyncState] => {
  // if a keyset was provided, wrap it in a keyring
  const keyring = createKeyring(keys)

  const their = message
  // This should never happen, but just as a sanity check
  assert(graph.root === their.root, `Can't sync graphs with different roots`)

  const state: SyncState = {
    ...prevState,
    their: {
      head: their.head,
      need: their.need ?? [],
      encryptedLinks: { ...prevState.their.encryptedLinks, ...their.links },
      parentMap: { ...prevState.their.parentMap, ...their.parentMap },
    },
  }

  // if we've received links from them, try to reconstruct their graph and merge
  if (Object.keys(state.their.encryptedLinks).length > 0) {
    // reconstruct their graph
    const { head } = their

    const ourChildMap = getChildMap(graph)
    const theirChildMap = invertLinkMap(state.their.parentMap)
    const childMap = { ...ourChildMap, ...theirChildMap }

    const encryptedLinks = {
      ...graph.encryptedLinks,
      ...state.their.encryptedLinks,
    }
    const encryptedGraph = {
      ...graph,
      head,
      encryptedLinks,
      childMap,
    }

    const theirGraph = decrypt({ encryptedGraph, keys: keyring })

    // merge with our graph
    const mergedGraph = merge(graph, theirGraph)

    // Check the integrity of the merged graph. The full set runs first because it's the cheaper
    // question — `validateStructure`'s memo key is a content hash of the whole graph, and paying
    // for one on every message is what made this path slow before. On the happy path we never do.
    const validation = validate(mergedGraph)
    if (validation.isValid) {
      graph = mergedGraph
    } else {
      // Something failed, but not everything that can fail is a reason to refuse the merge. Only
      // the structural rules say whether this is a graph anyone can replay; the advisory rules say
      // whether its timestamps agree with ours, which is a different question with a different
      // answer when two honest peers' clocks disagree. See `advisoryValidators`.
      const structure = validateStructure(mergedGraph)
      if (structure.isValid) {
        // Advisory only. A peer whose clock runs ten minutes fast, or who merged such a peer and
        // then appended on a correct clock, produces exactly this — and refusing it used to leave
        // the two of us unable to sync until wall clock caught up with the graph, or, for an
        // out-of-order link, for good. So we take the merge and note what we saw. It is not a
        // failed sync and it doesn't count as one: `failedSyncCount` is what an application reads
        // to decide a peer isn't worth talking to, and a disagreement about the time is not that.
        graph = mergedGraph
        state.advisoryFailureCount += 1
        state.lastAdvisoryError = validation.error
      } else {
        // We only get here if we've received bad links from them — maliciously, or not. The
        // application should monitor `failedSyncCount` and decide not to trust them if it's too
        // high. Record the error so we can surface it in generateMessage.
        state.failedSyncCount += 1
        state.our.reportedError = structure.error
      }
    }

    // either way, we can discard all pending links
    state.their.encryptedLinks = {}
    state.their.parentMap = {}
  }

  return [graph, state]
}
