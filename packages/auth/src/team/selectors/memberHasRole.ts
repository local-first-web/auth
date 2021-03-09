import { ADMIN } from '@/role'
import { member as selectMember } from '@/team/selectors/member'
import { TeamState } from '@/team/types'

export const memberHasRole = (state: TeamState, userName: string, role: string) => {
  const member = selectMember(state, userName)
  const { roles = [] } = member
  return roles.includes(role)
}

export const memberIsAdmin = (state: TeamState, userName: string) =>
  memberHasRole(state, userName, ADMIN)
