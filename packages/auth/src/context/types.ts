import { type DeviceWithSecrets } from '@/device'
import { type ServerWithSecrets } from '@/server'
import { type SemVer } from '@/util'
import { type UserWithSecrets } from 'crdx'

export type LocalContext = LocalUserContext | ServerContext

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
