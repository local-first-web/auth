import { User } from '/user'
import { Transform } from './index'

export const addMember = (user: User): Transform => (state) => ({
  ...state,
  members: [...state.members, { ...user, roles: [] }],
})
