import { Reducer } from '@/team/reducers/index'

export const removeMember = (userName: string): Reducer => state => ({
  ...state,

  // remove this member
  members: state.members.filter(member => member.userName !== userName),

  // add their name to the list of removed members
  removedMembers: [...state.removedMembers, userName],

  // remove any lockboxes belonging to this member
  lockboxes: state.lockboxes.filter(lockbox => lockbox.recipient.name !== userName),
})
