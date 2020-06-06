import { ADMIN } from '/role'
import { TeamState } from '/team/types'

export const membersInRole = (state: TeamState, roleName: string) =>
  state.members.filter(member => member.roles?.includes(roleName))

export const admins = (state: TeamState) => membersInRole(state, ADMIN)
