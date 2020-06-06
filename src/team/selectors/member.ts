import { TeamState } from '/team/types'

export const member = (state: TeamState, userName: string) => {
  const member = state.members.find(m => m.name === userName)
  if (!member) throw new Error(`A member named '${userName}' was not found`)
  return member
}
