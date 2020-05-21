import { Transform } from './index'

export const revokeMember = (userName: string): Transform => (state) => ({
  ...state,
  members: state.members.filter((member) => member.userName !== userName),
})
