import { type DeviceWithSecrets } from '@/device'
import { type ServerWithSecrets } from '@/server'
import { type SemVer } from '@/util'
import { type UserWithSecrets } from 'crdx'

export interface LocalUserContext {
  user: UserWithSecrets
  device: DeviceWithSecrets
  client?: Client
}

export interface ServerContext {
  server: ServerWithSecrets
  client?: Client
}

export interface Client {
  name: string
  version: SemVer
}
