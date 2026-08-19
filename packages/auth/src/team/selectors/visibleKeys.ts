import { type KeysetWithSecrets } from '@localfirst/crdx'
import { open } from '../../lockbox/index.js'
import { type TeamState } from '../types.js'

/**
 * Returns all keys that can be accessed directly or indirectly (via lockboxes) by the given keyset
 *
 * @param state
 * @param keyset
 * @param alreadyVisited The keysets this walk has already expanded, by encryption public key.
 * Lockboxes form a graph, not a tree — what stopped this recursing forever was that honest ones
 * only ever point away from their recipient. Nothing enforced that: a member posting
 * `create(k1, k2)` and `create(k2, k1)` on one link — both well-formed, both holding keysets they
 * minted themselves, neither malformed in any way a check could name — made this recurse until
 * `Maximum call stack size exceeded`, at merge, at every later action, and on reload from the
 * victim's own `save()`. Permanent, and aimed at whichever member the first lockbox was addressed
 * to.
 */
export const visibleKeys = (
  state: TeamState,
  keyset: KeysetWithSecrets,
  alreadyVisited = new Set<string>()
): KeysetWithSecrets[] => {
  const { lockboxes } = state
  const { publicKey } = keyset.encryption

  if (alreadyVisited.has(publicKey)) return []
  alreadyVisited.add(publicKey)

  // What lockboxes can I open with these keys?
  const lockboxesICanOpen = lockboxes.filter(({ recipient }) => recipient.publicKey === publicKey)

  // Collect all the keys from those lockboxes. A lockbox that doesn't open to the keyset its own
  // manifest describes gives us nothing — see `lockbox.open`, which is where that's decided.
  const keysets = lockboxesICanOpen
    .map(lockbox => open(lockbox, keyset))
    .filter((keys): keys is KeysetWithSecrets => keys !== undefined)

  // Recursively get all the keys *those* keys can access
  const keys = keysets.flatMap(keyset => visibleKeys(state, keyset, alreadyVisited))

  return [...keysets, ...keys]
}
