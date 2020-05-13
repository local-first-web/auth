import { Context } from '../context'
import { Member } from '../member'
import { Role } from '../role'

export interface TeamState {
  teamName: string
  rootContext?: Context
  members: Member[]
  roles: Role[]
}
