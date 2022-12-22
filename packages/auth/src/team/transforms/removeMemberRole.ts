import { Transform } from '@/team/types'
import { KeyType } from 'crdx'

export const removeMemberRole =
  (userName: string, roleName: string): Transform =>
  state => ({
    ...state,

    // remove this role from this member's list of roles
    members: state.members.map(member => {
      return {
        ...member,
        roles:
          member.userName !== userName //
            ? member.roles // leave other members' roles alone
            : member.roles.filter(r => r !== roleName),
      }
    }),

    // remove any lockboxes this member has for this role
    lockboxes: state.lockboxes.filter(
      lockbox =>
        !(
          lockbox.recipient.name === userName &&
          lockbox.contents.type === KeyType.ROLE &&
          lockbox.contents.name === roleName
        )
    ),
  })
