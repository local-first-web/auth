import { type TeamState } from 'team/types.js'

export const member = (state: TeamState, userId: string, options = { includeRemoved: false }) => {
  const membersToSearch = [
    ...state.members,
    ...(options.includeRemoved ? state.removedMembers : []),
  ]
  const member = membersToSearch.find(m => m.userId === userId)

  if (member === undefined) {
    throw new Error(`A member named '${userId}' was not found`)
  }

  return member
}

export const members = (state: TeamState, userIds: string[], options = { includeRemoved: false, throwOnMissing: true }) => {
  const membersToSearch = [
    ...state.members,
    ...(options.includeRemoved ? state.removedMembers : []),
  ]
  const members = membersToSearch.filter(m => userIds.includes(m.userId))

  if (members.length < userIds.length) {
    const message = `Expected ${userIds.length} members but found ${members.length}`
    if (options.throwOnMissing) {
      throw new Error(message)
    }
    console.error(message)
  }

  return members
}
