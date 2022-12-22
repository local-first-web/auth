import { ADMIN } from '@/role'
import * as select from '@/team/selectors'
import { TeamState } from '@/team/types'

export const memberHasRole = (state: TeamState, userId: string, role: string) => {
  if (!select.hasMember(state, userId)) return false
  const member = select.member(state, userId)
  const { roles = [] } = member
  return roles.includes(role)
}

export const memberIsAdmin = (state: TeamState, userId: string) =>
  memberHasRole(state, userId, ADMIN)
