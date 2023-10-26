import { type TeamState } from 'team/types.js'

export const hasMember = (state: TeamState, userId: string) =>
  state.members.find(m => m.userId === userId) !== undefined
