import { DeviceWithSecrets, getDeviceId } from '@/device'
import { TeamState } from '@/team/types'
import { assert, Optional } from '@/util'
import { lockboxSummary } from '@/util/lockboxSummary'
import { KeyMetadata } from 'crdx'
import { getKeyMap } from './getKeyMap'

/** Returns the keys for the given scope, if they are in a lockbox that the current device has
 * access to. */
export const keys = (
  state: TeamState,
  currentDevice: DeviceWithSecrets,
  scope: Optional<KeyMetadata, 'generation'>
) => {
  const { type, name, generation: maybeGeneration } = scope

  const { userId, deviceName } = currentDevice
  const deviceId = getDeviceId({ userId, deviceName })
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
