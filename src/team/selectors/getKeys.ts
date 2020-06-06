import { KeysetWithSecrets } from '/keys'
import { open } from '/lockbox'
import { KeysetMap, TeamState } from '/team/types'
import { UserWithSecrets } from '/user'

/** Returns all keysets from the current user's lockboxes in a structure that looks like this:
 * ```ts
 * {
 *    TEAM: {
 *      TEAM: Keyset[], // <- all keys starting with generation 0
 *    ROLE: {
 *      admin: Keyset[]
 *      managers: Keyset[]
 *    },
 * }
 * ```
 */
export const getMyKeys = (state: TeamState, currentUser: UserWithSecrets): KeysetMap => {
  const usersOwnKeys = currentUser.keysetHistory || [currentUser.keys] // if there's no history, just use the keys we have
  const allVisibleKeys = usersOwnKeys.flatMap(keys => getDerivedKeys(state, keys))
  return allVisibleKeys.reduce(organizeKeysIntoMap, {})
}

const getDerivedKeys = (state: TeamState, keyset: KeysetWithSecrets): KeysetWithSecrets[] => {
  const { lockboxes } = state
  const publicKey = keyset.encryption.publicKey
  const lockboxesICanUnlock = lockboxes.filter(({ recipient }) => recipient.publicKey === publicKey)
  const keysets = lockboxesICanUnlock.map(lockbox => open(lockbox, keyset))
  const derivedKeysets = keysets.flatMap(keyset => getDerivedKeys(state, keyset))
  return [...keysets, ...derivedKeysets]
}

const organizeKeysIntoMap = (result: KeysetMap, keys: KeysetWithSecrets) => {
  const { scope, name, generation } = keys
  const keysetsForScope = result[scope] || {}
  const keysetHistory = keysetsForScope[name] || []
  keysetHistory[generation] = keys
  return {
    ...result,
    [scope]: {
      ...keysetsForScope,
      [name]: keysetHistory,
    },
  } as KeysetMap
}
