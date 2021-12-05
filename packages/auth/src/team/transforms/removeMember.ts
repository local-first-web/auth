import { Transform } from '@/team/types'

export const removeMember =
  (userName: string): Transform =>
  state => {
    const remainingMembers = state.members.filter(m => m.userName !== userName)
    const removedMember = state.members.find(m => m.userName === userName) // the member that was removed

    const removedMembers = [...state.removedMembers]
    if (removedMember) removedMembers.push(removedMember)

    const remainingLockboxes = state.lockboxes.filter(
      lockbox => lockbox.recipient.name !== userName
    )
    return {
      ...state,
      members: remainingMembers,
      removedMembers,
      lockboxes: remainingLockboxes,
    }
  }
