import { Role } from '@/role/index.js'
import { Transform } from '@/team/types.js'

export const addRole =
  (newRole: Role): Transform =>
  state => ({
    ...state,
    roles: [...state.roles, newRole],
  })
