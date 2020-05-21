import { Role } from '/role'
import { Reducer } from './index'

export const addRole = (newRole: Role): Reducer => state => ({
  ...state,
  roles: [...state.roles, newRole],
})
