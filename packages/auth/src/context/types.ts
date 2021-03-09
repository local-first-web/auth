import { DeviceWithSecrets, PublicDevice } from '@/device'
import { Member } from '@/member'
import { User } from '@/user'
import { SemVer } from '@/util'

export interface LocalDeviceContext {
  client?: Client
  user?: User // not required when initializing a team (because a device joining with an invitation doesn't have a user yet)
  device: DeviceWithSecrets
}

export interface LocalUserContext extends LocalDeviceContext {
  user: User // required in all other cases
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
