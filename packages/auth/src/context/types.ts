import { DeviceWithSecrets, PublicDevice } from '@/device'
import { Member } from '@/team'
import { SemVer } from '@/util'
import { UserWithSecrets } from 'crdx'

export interface LocalDeviceContext {
  client?: Client
  user?: UserWithSecrets // not required when initializing a team (because a device joining with an invitation doesn't have a user yet)
  device: DeviceWithSecrets
}

export interface LocalUserContext extends LocalDeviceContext {
  user: UserWithSecrets // required in all other cases
}

export interface MemberContext {
  client?: Client
  member: Member
  device: PublicDevice
}

export interface Client {
  name: string
  version: SemVer
}
