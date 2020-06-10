import { Reducer } from '/team/reducers/index'

export const addMemberRoles = (userName: string, roles: string[] = []): Reducer[] =>
  roles.map(roleName => state => ({
    ...state,
    members: state.members.map(member => {
      const memberRoles = member.roles || []
      return {
        ...member,
        roles:
          member.userName !== userName || memberRoles.includes(roleName)
            ? memberRoles
            : [...memberRoles, roleName],
      }
    }),
  }))
