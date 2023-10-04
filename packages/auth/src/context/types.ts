import { DeviceWithSecrets } from '@/device/index.js'
import { SemVer } from '@/util/index.js'
import { UserWithSecrets } from 'crdx'

export interface LocalUserContext {
  user: UserWithSecrets
  device: DeviceWithSecrets
  client?: Client
}

export interface Client {
  name: string
  version: SemVer
}
