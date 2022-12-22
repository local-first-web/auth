import { ADMIN } from '@/role'
import * as select from '@/team/selectors'
import { TeamState } from '@/team/types'

export const memberHasRole = (state: TeamState, userName: string, role: string) => {
  if (!select.hasMember(state, userName)) return false
  const member = select.member(state, userName)
  const { roles = [] } = member
  return roles.includes(role)
}

export const memberIsAdmin = (state: TeamState, userName: string) =>
  memberHasRole(state, userName, ADMIN)
