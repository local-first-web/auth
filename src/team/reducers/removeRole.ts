import { Reducer } from './index'

export const removeRole = (roleName: string): Reducer => state => ({
  ...state,
  roles: state.roles.filter(role => role.roleName !== roleName),
})
