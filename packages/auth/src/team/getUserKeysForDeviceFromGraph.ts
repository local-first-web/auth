import type { Keyring, KeysetWithSecrets } from '@localfirst/crdx'
import { type DeviceWithSecrets } from 'device/index.js'
import { KeyType } from 'util/index.js'
import { getTeamState } from './getTeamState.js'
import * as select from './selectors/index.js'

const { USER } = KeyType

export const getUserKeysForDeviceFromGraph = (
  serializedGraph: string,
  keyring: Keyring,
  device: DeviceWithSecrets
): KeysetWithSecrets => {
  const state = getTeamState(serializedGraph, keyring)
  const userScope = { type: USER, name: device.userId }
  const keys = select.keys(state, device.keys, userScope)
  return keys
}
