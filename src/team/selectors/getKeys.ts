import { open, Lockbox } from '/lockbox'
import { KeysetMap, TeamState } from '/team/types'
import { UserWithSecrets } from '/user'
import { KeysetWithSecrets } from '/keys'

/** Returns all keysets from the given user's lockboxes in a structure that looks like this:
 * ```ts
 * {
 *    TEAM: {
 *      TEAM: Keyset[],
 *    ROLE: {
 *      admin: Keyset[]
 *      managers: Keyset[]
 *    },
 * }
 * ```
 */
export const getKeys = (state: TeamState, user: UserWithSecrets): KeysetMap => {
  const usersOwnKeys = user.keysetHistory || [user.keys] // if there's no history, just use the keys we have
  const allVisibleKeys = usersOwnKeys.flatMap(getDerivedKeys(state.lockboxes))
  return allVisibleKeys.reduce(organizeKeysIntoMap, {})
}

const getDerivedKeys = (lockboxes: Lockbox[]) => (keyset: KeysetWithSecrets) =>
  getKeysUnlockedBy(keyset, lockboxes)
const getKeysUnlockedBy = (
  keyset: KeysetWithSecrets,
  lockboxes: Lockbox[]
): KeysetWithSecrets[] => {
  const publicKey = keyset.encryption.publicKey
  const lockboxesThatThisKeyOpens = lockboxes.filter(l => l.recipient.publicKey === publicKey)
  const keysets = lockboxesThatThisKeyOpens.map(lockbox => open(lockbox, keyset))
  const derivedKeysets = keysets.flatMap(keyset => getKeysUnlockedBy(keyset, lockboxes))
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
