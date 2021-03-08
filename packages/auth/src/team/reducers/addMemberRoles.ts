import { Reducer } from '/team/reducers/index'

export const addMemberRoles = (userName: string, roles: string[] = []): Reducer[] =>
  roles.map(roleName => state => ({
    ...state,
    members: state.members.map(member => ({
      ...member,
      roles:
        member.userName !== userName || member.roles.includes(roleName)
          ? member.roles
          : [...member.roles, roleName],
    })),
  }))
