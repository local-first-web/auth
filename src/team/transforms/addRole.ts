import { Role } from '/role'
import { Transform } from './index'

export const addRole = (newRole: Role): Transform => (state) => ({
  ...state,
  roles: [...state.roles, newRole],
})
