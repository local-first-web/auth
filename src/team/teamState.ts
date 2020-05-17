import { Context } from '/context'
import { Member } from '/member'
import { Role } from '/role'
import { Lockbox } from '/lockbox'
import { KeysetWithSecrets } from '/keys'

export interface TeamLockboxMap {
  [userName: string]: UserLockboxMap
}

export interface UserLockboxMap {
  [publicKey: string]: Lockbox[]
}

export interface KeysetMap {
  [scope: string]: KeysetWithSecrets
}

export interface TeamState {
  teamName: string
  rootContext?: Context
  members: Member[]
  roles: Role[]
  lockboxes: TeamLockboxMap
}
