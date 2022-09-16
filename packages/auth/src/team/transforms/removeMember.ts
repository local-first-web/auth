import { Transform } from '@/team/types'

export const removeMember =
  (userId: string): Transform =>
  state => {
    const remainingMembers = state.members.filter(m => m.userId !== userId)
    const removedMember = state.members.find(m => m.userId === userId) // the member that was removed

    const removedMembers = [...state.removedMembers]
    if (removedMember) removedMembers.push(removedMember)

    const remainingLockboxes = state.lockboxes.filter(lockbox => lockbox.recipient.name !== userId)
    return {
      ...state,
      members: remainingMembers,
      removedMembers,
      lockboxes: remainingLockboxes,
    }
  }
