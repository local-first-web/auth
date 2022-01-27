import { DeviceWithSecrets } from '@/device'
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
export const getKeyMap = (state: TeamState, currentDevice: DeviceWithSecrets): KeyMap => {
  // TODO: get all the keys the device has ever had
  //
  // const usersOwnKeys = currentUser.keyHistory || [currentUser.keys] // if there's no history, just use the current keys
  const deviceKeys = [currentDevice.keys] // if there's no history, just use the current keys

  // get all the keys those keys can access
  const allVisibleKeys = deviceKeys.flatMap(keys => getVisibleKeys(state, keys))

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
