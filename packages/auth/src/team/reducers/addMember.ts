import { Reducer } from '@/team/reducers/index'
import { Member } from '@/member'

export const addMember = (newMember: Member): Reducer => state => ({
  ...state,

  // add member to the team's list of members
  members: [
    ...state.members,
    {
      ...newMember,
      roles: [],
    },
  ],

  // remove member's name from list of removed members (e.g. if member was removed and is now being re-added)
  removedMembers: state.removedMembers.filter(userName => userName === newMember.userName),
})
