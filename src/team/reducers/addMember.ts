import { User } from '/user'
import { Reducer } from './index'

export const addMember = (user: User): Reducer => state => ({
  ...state,
  members: [...state.members, { ...user, roles: [] }],
})
