import { ADMIN } from '/role'
import { getMember } from '/team/selectors/getMember'
import { TeamState } from '/team/types'

export const memberHasRole = (state: TeamState, userName: string, role: string) => {
  const member = getMember(state, userName)
  return member.roles.includes(role)
}

export const memberIsAdmin = (state: TeamState, userName: string) =>
  memberHasRole(state, userName, ADMIN)
