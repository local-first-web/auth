import { KeysetWithSecrets, PublicKeyset as Keyset } from 'keys'
import { Base64, SemVer } from 'lib/types'

export interface ContextWithSecrets {
  user: UserWithSecrets
  device: Device
  client: Client
}

export interface Context {
  user: User
  device: Device
  client: Client
}

/** A user and their full set of keys, including secrets. SHOULD NEVER LEAVE THE LOCAL USER'S DEVICE.  */
export interface UserWithSecrets {
  /** Username (or ID or email) */
  name: string
  /** The user's keys, including their secrets. */
  keys: KeysetWithSecrets
}

/** A user and their public keys.  */
export interface User {
  /** Username (or ID or email) */
  name: string
  /** The user's public keys */
  keys: Keyset
}

export enum DeviceType {
  desktop,
  laptop,
  tablet,
  mobile,
  bot,
  server,
  other,
}

export interface Device {
  id?: Base64
  name: string
  type: DeviceType
}

export interface Client {
  name: string
  version: SemVer
}
