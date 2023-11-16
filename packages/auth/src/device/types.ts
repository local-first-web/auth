import type { Keyset, KeysetWithSecrets } from '@localfirst/crdx'
import type { Optional } from 'util/types.js'

export type DeviceInfo = {
  userId: string
  deviceId: string
  deviceName: string
}

export type DeviceWithSecrets = {
  keys: KeysetWithSecrets
} & DeviceInfo

export type FirstUseDeviceWithSecrets = Optional<DeviceWithSecrets, 'userId'>

export type Device = {
  keys: Keyset
} & DeviceInfo
