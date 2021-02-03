import { PublicDevice } from '/device'
import { Member } from '/member'
import { User } from '/user'
import { SemVer } from '/util'

export interface LocalUserContext {
  client?: Client
  user: User
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
