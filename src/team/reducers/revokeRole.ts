import { Reducer } from './index'

export const revokeRole = (roleName: string): Reducer => state => ({
  ...state,
  roles: state.roles.filter(role => role.roleName !== roleName),
})
