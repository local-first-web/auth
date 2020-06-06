import { SemVer } from '/lib'
import { LocalUser } from '/user'
import { Member } from '/member'

interface Context {
  device: Device
  client?: Client
}

export interface LocalUserContext extends Context {
  user: LocalUser
}

export interface MemberContext extends Context {
  member: Member
}

export enum DeviceType {
  desktop,
  laptop,
  tablet,
  mobile,
  bot,
  server,
  other,
}

export interface Device {
  name: string
  type: DeviceType
}

export interface Client {
  name: string
  version: SemVer
}
