import { Transform } from '@/team/types'

export const removeMember =
  (userId: string): Transform =>
  state => {
    const remainingMembers = state.members.filter(m => m.userId !== userId)
    const removedMember = state.members.find(m => m.userId === userId) // the member that was removed

    const removedMembers = [...state.removedMembers]
    if (removedMember) removedMembers.push(removedMember)

    return {
      ...state,
      members: remainingMembers,
      removedMembers,
    }
  }
