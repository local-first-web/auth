import { type KeysetWithSecrets } from '@localfirst/crdx'
import { open } from '../../lockbox/index.js'
import { type TeamState } from '../types.js'

/**
 * Returns all keys that can be accessed directly or indirectly (via lockboxes) by the given keyset
 * @param state
 * @param keyset
 */
export const visibleKeys = (state: TeamState, keyset: KeysetWithSecrets): KeysetWithSecrets[] => {
  const { lockboxes } = state
  const { publicKey } = keyset.encryption

  // What lockboxes can I open with these keys?
  const lockboxesICanOpen = lockboxes.filter(({ recipient }) => recipient.publicKey === publicKey)

  // Collect all the keys from those lockboxes. A lockbox that doesn't open to the keyset its own
  // manifest describes gives us nothing — see `lockbox.open`, which is where that's decided.
  const keysets = lockboxesICanOpen
    .map(lockbox => open(lockbox, keyset))
    .filter((keys): keys is KeysetWithSecrets => keys !== undefined)

  // Recursively get all the keys *those* keys can access
  const keys = keysets.flatMap(keyset => visibleKeys(state, keyset))

  return [...keysets, ...keys]
}
