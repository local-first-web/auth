import { ADMIN } from '@/role/index.js'
import { TeamState } from '@/team/types.js'

export const membersInRole = (state: TeamState, roleName: string) =>
  state.members.filter(member => member.roles && member.roles.includes(roleName))

export const admins = (state: TeamState) => membersInRole(state, ADMIN)
