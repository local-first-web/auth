import { TeamState } from '/team/types'

export const hasRole = (state: TeamState, roleName: string) =>
  state.roles.find(r => r.roleName === roleName) !== undefined
