import { DeviceWithSecrets } from '@/device'
import { SemVer } from '@/util'
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
