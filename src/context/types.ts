import { PublicDevice } from '/device'
import { Member } from '/member'
import { User } from '/user'
import { SemVer } from '/util'

interface Context {
  client?: Client
}

export interface LocalUserContext extends Context {
  user: User
}

export interface MemberContext extends Context {
  member: Member
  device: PublicDevice
}

export interface Client {
  name: string
  version: SemVer
}
