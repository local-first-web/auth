import { Reducer } from './index'
import { KeyType } from '/keyset'

export const removeRole = (roleName: string): Reducer => state => ({
  ...state,

  // remove this role
  roles: state.roles.filter(role => role.roleName !== roleName),

  // remove any lockboxes for this role
  lockboxes: state.lockboxes.filter(
    lockbox => !(lockbox.contents.type === KeyType.ROLE && lockbox.contents.name === roleName)
  ),
})
