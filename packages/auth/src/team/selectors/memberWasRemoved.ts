import { TeamState } from '@/team/types'

export const memberWasRemoved = (state: TeamState, userName: string) =>
  state.removedMembers.includes(userName)
