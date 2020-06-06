import { ADMIN } from '/role'
import { member } from './member'
import { TeamState } from '/team/types'

export const memberHasRole = (state: TeamState, userName: string, role: string) => {
  const m = member(state, userName)
  return m.roles.includes(role)
}

export const memberIsAdmin = (state: TeamState, userName: string) =>
  memberHasRole(state, userName, ADMIN)
