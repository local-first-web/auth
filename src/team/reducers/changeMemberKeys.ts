import { Reducer } from '/team/reducers/index'
import { PublicKeyset } from '/keyset'

export const changeMemberKeys = (keys: PublicKeyset): Reducer => state => ({
  ...state,
  members: state.members.map(member => {
    if (member.userName === keys.name) {
      return {
        ...member,
        keys, // 🡐 replace keys with new ones
      }
    } else return member
  }),
})
