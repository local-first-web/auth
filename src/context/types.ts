import { Base64, SemVer } from 'lib/types'
import { User, UserWithSecrets } from '../user'

export interface ContextWithSecrets {
  user: UserWithSecrets
  device: Device
  client?: Client
}

export interface Context {
  user: User
  device: Device
  client: Client
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
  name: string
  type: DeviceType
}

export interface Client {
  name: string
  version: SemVer
}
