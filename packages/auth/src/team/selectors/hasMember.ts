import { TeamState } from '@/team/types'

export const hasMember = (state: TeamState, userId: string) =>
  state.members.find(m => m.userId === userId) !== undefined
