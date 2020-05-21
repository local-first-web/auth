import { Reducer } from './index'

export const revokeMember = (userName: string): Reducer => state => ({
  ...state,
  members: state.members.filter(member => member.userName !== userName),
})
