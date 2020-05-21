import { Transform } from './index'

export const addMemberRoles = (userName: string, roles: string[] = []): Transform[] =>
  roles.map((roleName) => (state) => ({
    ...state,
    members: state.members.map((m) => {
      if (m.userName === userName && !m.roles.includes(roleName)) m.roles.push(roleName)
      return m
    }),
  }))
