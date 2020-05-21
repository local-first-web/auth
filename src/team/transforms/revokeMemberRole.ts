import { Transform } from './index'

export const revokeMemberRole = (userName: string, roleName: string): Transform => state => ({
  ...state,
  members: state.members.map(member => ({
    ...member,
    roles:
      member.userName !== userName //
        ? member.roles
        : member.roles.filter(r => r !== roleName),
  })),
})
