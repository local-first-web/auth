import { Transform } from '@/team/types'
import { KeyType } from '@/util'

export const removeMemberRole =
  (userId: string, roleName: string): Transform =>
  state => ({
    ...state,

    // remove this role from this member's list of roles
    members: state.members.map(member => {
      return {
        ...member,
        roles:
          member.userId !== userId //
            ? member.roles // leave other members' roles alone
            : member.roles.filter(r => r !== roleName),
      }
    }),

    // remove any lockboxes this member has for this role
    lockboxes: state.lockboxes.filter(
      lockbox =>
        !(
          lockbox.recipient.name === userId &&
          lockbox.contents.type === KeyType.ROLE &&
          lockbox.contents.name === roleName
        ),
    ),
  })
