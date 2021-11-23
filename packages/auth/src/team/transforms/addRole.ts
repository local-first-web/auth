import { Role } from '@/role'
import { Transform } from '@/team/types'

export const addRole =
  (newRole: Role): Transform =>
  state => ({
    ...state,
    roles: [...state.roles, newRole],
  })
