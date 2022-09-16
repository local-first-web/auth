import { Keyset, KeysetWithSecrets } from 'crdx'

export interface DeviceInfo {
  userId: string
  deviceName: string
}

export interface DeviceWithSecrets extends DeviceInfo {
  keys: KeysetWithSecrets
}

export interface Device extends DeviceInfo {
  keys: Keyset
}
