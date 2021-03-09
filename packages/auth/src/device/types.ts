import { KeysetWithSecrets, PublicKeyset } from '@/keyset'

export interface DeviceInfo {
  userName: string
  deviceName: string
}

export interface DeviceWithSecrets extends DeviceInfo {
  keys: KeysetWithSecrets
}

export interface PublicDevice extends DeviceInfo {
  keys: PublicKeyset
}
