import { Reducer } from '/team/reducers/index'

export const addDevice = (userName: string): Reducer => state => {
  return {
    ...state,
    members: state.members.map(member => {
      if (member.userName === userName) {
        const { devices } = member

        return {
          ...member,
          devices,
        }
      } else return member
    }),
  }
}
