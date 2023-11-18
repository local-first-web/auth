import { type TeamState } from 'team/types.js'

export const memberWasRemoved = (state: TeamState, userId: string) => {
  return state.removedMembers.some(m => m.userId === userId)
}
