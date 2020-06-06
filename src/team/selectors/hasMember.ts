import { TeamState } from '/team/types'

export const hasMember = (state: TeamState, userName: string) =>
  state.members.find(m => m.name === userName) !== undefined
