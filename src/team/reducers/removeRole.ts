import { Reducer } from './index'
import { KeysetScope } from '/keys'

export const removeRole = (roleName: string): Reducer => state => ({
  ...state,

  // remove this role
  roles: state.roles.filter(role => role.roleName !== roleName),

  // remove any lockboxes for this role
  lockboxes: state.lockboxes.filter(
    lockbox => !(lockbox.contents.scope === KeysetScope.ROLE && lockbox.contents.name === roleName)
  ),
})
