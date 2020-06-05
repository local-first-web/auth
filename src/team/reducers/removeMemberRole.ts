import { Reducer } from './index'
import { KeysetScope } from '/keys'

export const removeMemberRole = (userName: string, roleName: string): Reducer => state => ({
  ...state,

  // remove this role from this member's list of roles
  members: state.members.map(member => ({
    ...member,
    roles:
      member.userName !== userName //
        ? member.roles
        : member.roles.filter(r => r !== roleName),
  })),

  // remove any lockboxes this member has for this role
  lockboxes: state.lockboxes.filter(
    lockbox =>
      !(
        lockbox.recipient.name === userName &&
        lockbox.contents.scope === KeysetScope.ROLE &&
        lockbox.contents.name === roleName
      )
  ),
})
