import { Reducer } from './index'

export const removeMember = (userName: string): Reducer => state => ({
  ...state,
  members: state.members.filter(member => member.userName !== userName),
})
