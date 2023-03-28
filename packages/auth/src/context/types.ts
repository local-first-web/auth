import { type DeviceWithSecrets } from '@/device'
import { type ServerWithSecrets } from '@/server'
import { type UserWithSecrets } from '@localfirst/crdx'

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
  version: string
}
