import { type Keyset, type KeysetWithSecrets } from '@localfirst/crdx'

export type DeviceInfo = {
  userId: string
  deviceId: string
  deviceName: string
}

export type DeviceWithSecrets = {
  keys: KeysetWithSecrets
} & DeviceInfo

export type Device = {
  keys: Keyset
} & DeviceInfo
