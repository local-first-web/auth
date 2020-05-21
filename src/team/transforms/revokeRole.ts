import { Transform } from './index'

export const revokeRole = (roleName: string): Transform => (state) => ({
  ...state,
  roles: state.roles.filter((role) => role.roleName !== roleName),
})
