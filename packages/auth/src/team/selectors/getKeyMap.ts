import { TeamState } from '@/team/types'
import { KeysetWithSecrets } from 'crdx'
import { getVisibleKeys } from './getVisibleKeys'

/** Returns all keysets from the current user's lockboxes in a structure that looks like this:
 * ```js
 * {
 *    TEAM: {
 *      TEAM: Keyset[ gen0, gen1, gen2 ... ], // <- all keys starting with generation 0
 *    ROLE: {
 *      admin: Keyset[ gen0 ... ]
 *      managers: Keyset[ gen0 ...]
 *    },
 * }
 * ```
 */
export const getKeyMap = (state: TeamState, deviceKeys: KeysetWithSecrets): KeyMap => {
  // get all the keys those keys can access
  const allVisibleKeys = getVisibleKeys(state, deviceKeys)

  // structure these keys as described above
  return allVisibleKeys.reduce(organizeKeysIntoMap, {})
}

const organizeKeysIntoMap = (result: KeyMap, keys: KeysetWithSecrets) => {
  const { type, name, generation } = keys
  const keysetsForScope = result[type] || {}
  const keysetHistory = keysetsForScope[name] || []
  keysetHistory[generation] = keys
  return {
    ...result,
    [type]: {
      ...keysetsForScope,
      [name]: keysetHistory,
    },
  } as KeyMap
}
interface KeyMap {
  [type: string]: {
    [name: string]: KeysetWithSecrets[]
  }
}
