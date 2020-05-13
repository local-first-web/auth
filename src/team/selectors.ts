import { TeamState } from './teamState'
import { ADMIN } from '../role'

export const hasMember = (state: TeamState, userName: string) =>
  state.members.find(m => m.userName === userName) !== undefined

export const getMember = (state: TeamState, userName: string) => {
  const member = state.members.find(m => m.userName === userName)
  if (!member) throw new Error(`A member named '${userName}' was not found`)
  return member
}

export const memberHasRole = (
  state: TeamState,
  userName: string,
  role: string
) => {
  const member = getMember(state, userName)
  return member.roles.includes(role)
}

export const memberIsAdmin = (state: TeamState, userName: string) =>
  memberHasRole(state, userName, ADMIN)
