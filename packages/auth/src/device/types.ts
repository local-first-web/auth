import type { Keyset, KeysetWithSecrets } from '@localfirst/crdx'

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

export type FirstUseDeviceWithSecrets = Omit<DeviceWithSecrets, 'userId'>
export type FirstUseDevice = Omit<Device, 'userId'>
