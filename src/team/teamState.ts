import { Context } from '/context'
import { Member } from '/member'
import { Role } from '/role'
import { Lockbox } from '/lockbox'

export interface TeamLockboxMap {
  [userName: string]: Lockbox[]
}

export interface TeamState {
  teamName: string
  rootContext?: Context
  members: Member[]
  roles: Role[]
  lockboxes: TeamLockboxMap
}
