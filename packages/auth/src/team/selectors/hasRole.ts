import { type TeamState } from 'team/types.js'

export const hasRole = (state: TeamState, roleName: string) =>
  state.roles.find(r => r.roleName === roleName) !== undefined
