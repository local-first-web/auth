import { KeysetWithSecrets, PublicKeyset } from '/keyset'
import { Base64 } from '/util'

export enum DeviceType {
  desktop,
  laptop,
  tablet,
  mobile,
  bot,
  server,
  other,
}

export interface DeviceInfo {
  userName: string
  name: string
  type: DeviceType
}

export interface DeviceWithSecrets extends DeviceInfo {
  keys: KeysetWithSecrets
}

/** We don't leak the device's name or type (or secret keys!) on the signature chain. */
export interface Device {
  userName: string
  deviceId: Base64
  keys: PublicKeyset
}
