import { open } from '@/lockbox'
import { TeamState } from '@/team/types'
import { KeysetWithSecrets } from 'crdx'

/**
 * Returns all keys that can be accessed directly or indirectly (via lockboxes) by the given keyset
 * @param state
 * @param keyset
 */
export const getVisibleKeys = (
  state: TeamState,
  keyset: KeysetWithSecrets,
): KeysetWithSecrets[] => {
  const { lockboxes } = state
  const publicKey = keyset.encryption.publicKey

  // what lockboxes can I open with these keys?
  const lockboxesICanOpen = lockboxes.filter(({ recipient }) => recipient.publicKey === publicKey)

  // collect all the keys from those lockboxes
  const keysets = lockboxesICanOpen.map(lockbox => open(lockbox, keyset))

  // recursively get all the keys *those* keys can access
  const visibleKeys = keysets.flatMap(keyset => getVisibleKeys(state, keyset))

  return [...keysets, ...visibleKeys]
}
