import { TeamState } from '@/team/types'

export const member = (state: TeamState, userName: string, options = { includeRemoved: false }) => {
  const membersToSearch = [
    ...state.members,
    ...(options.includeRemoved ? state.removedMembers : []),
  ]
  const member = membersToSearch.find(m => m.userName === userName)

  if (member === undefined) throw new Error(`A member named '${userName}' was not found`)
  return member
}
