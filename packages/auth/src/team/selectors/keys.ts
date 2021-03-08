import { memoize } from '/util'
import { DeviceWithSecrets, getDeviceId } from '/device'
import { KeyMetadata, KeysetWithSecrets } from '/keyset'
import { open } from '/lockbox'
import { TeamState } from '/team/types'
import { User } from '/user'
import { assert, debug, Optional } from '/util'
import { lockboxSummary } from '/util/lockboxSummary'

const log = debug('lf:auth:select:keys')

export const keys = (
  state: TeamState,
  currentDevice: DeviceWithSecrets,
  scope: Optional<KeyMetadata, 'generation'>
) => {
  const { type, name, generation: maybeGeneration } = scope

  const { userName, deviceName } = currentDevice
  const deviceId = getDeviceId({ userName, deviceName })
  const secretKey = currentDevice.keys.secretKey.slice(0, 5)

  const keysFromLockboxes = getKeyMap(state, currentDevice)
  const keys = keysFromLockboxes[type] && keysFromLockboxes[type][name]

  assert(
    keys,
    `Couldn't find keys: ${type.toLowerCase()} ${name}.
     Using device keys: ${deviceId}(${secretKey})
     Available lockboxes: \n- ${state.lockboxes.map(lockboxSummary).join('\n- ')} `
  )

  const generation = maybeGeneration === undefined ? keys.length - 1 : maybeGeneration // use latest generation by default
  return keys[generation]
}

/** Returns all keysets from the current user's lockboxes in a structure that looks like this:
 * ```js
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
const getKeyMap = (state: TeamState, currentDevice: DeviceWithSecrets): KeyMap => {
  // TODO: get all the keys the device has ever had
  //
  // const usersOwnKeys = currentUser.keyHistory || [currentUser.keys] // if there's no history, just use the current keys
  const deviceKeys = [currentDevice.keys] // if there's no history, just use the current keys

  // get all the keys those keys can access
  const allVisibleKeys = deviceKeys.flatMap(keys => getVisibleKeys(state, keys))

  // structure these keys as described above
  return allVisibleKeys.reduce(organizeKeysIntoMap, {})
}

/**
 * Returns all keys that can be accessed directly or indirectly (via lockboxes) by the given keyset
 * @param state
 * @param keyset
 */
const getVisibleKeys = (state: TeamState, keyset: KeysetWithSecrets): KeysetWithSecrets[] => {
  const { lockboxes } = state
  const publicKey = keyset.encryption.publicKey

  // what lockboxes can I open with these keys?
  const lockboxesICanOpen = lockboxes.filter(({ recipient }) => recipient.publicKey === publicKey)

  // collect all the keys from those lockboxes
  const keysets = lockboxesICanOpen.map(lockbox => open(lockbox, keyset))

  // recursively get all the keys *those* keys can access
  const visibileKeys = keysets.flatMap(keyset => getVisibleKeys(state, keyset))

  return [...keysets, ...visibileKeys]
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
