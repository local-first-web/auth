import { Keyset } from 'crdx'
import { Reducer } from '@/team/reducers/index'

export const changeMemberKeys =
  (keys: Keyset): Reducer =>
  state => {
    return {
      ...state,
      members: state.members.map(member => {
        if (member.userName === keys.name) {
          return {
            ...member,
            keys, // 🡐 replace keys with new ones
          }
        } else return member
      }),
    }
  }
