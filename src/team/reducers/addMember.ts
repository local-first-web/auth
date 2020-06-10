import { Reducer } from '/team/reducers/index'
import { Member } from '/member'

export const addMember = (newMember: Member): Reducer => state => ({
  ...state,
  members: [
    ...state.members,
    {
      ...newMember,
      roles: [],
    },
  ],
})
