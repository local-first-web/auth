import { Transform } from '@/team/types'
import { KeyType } from 'crdx'

export const removeRole =
  (roleName: string): Transform =>
  state => ({
    ...state,

    // remove this role
    roles: state.roles.filter(role => role.roleName !== roleName),

    // remove any lockboxes for this role
    lockboxes: state.lockboxes.filter(
      lockbox => !(lockbox.contents.type === KeyType.ROLE && lockbox.contents.name === roleName)
    ),
  })
