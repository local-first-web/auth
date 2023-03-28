import { Device, DeviceWithSecrets } from '@/device'
import { Member } from '@/team'
import { User, UserWithSecrets } from '@localfirst/crdx'
import { Server, ServerWithSecrets } from './types'

const toMember = (server: Server): Member => ({
  userId: server.host,
  userName: server.host,
  keys: server.keys,
  roles: [],
})

const toUser = <T extends Server | ServerWithSecrets>(server: T) =>
  ({
    userId: server.host,
    userName: server.host,
    keys: server.keys,
  } as T extends Server ? User : UserWithSecrets)

const toDevice = <T extends Server | ServerWithSecrets>(server: T) =>
  ({
    userId: server.host,
    deviceName: server.host,
    keys: server.keys,
  } as T extends Server ? Device : DeviceWithSecrets)

export const cast = { toMember, toUser, toDevice }
