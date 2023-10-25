import { type TeamState } from '@/team/types.js'

export const memberWasRemoved = (state: TeamState, userId: string) =>
  state.removedMembers.some(m => m.userId === userId)
