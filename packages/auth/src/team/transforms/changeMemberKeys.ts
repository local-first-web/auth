import { Keyset } from 'crdx'
import { Transform } from '@/team/types'

export const changeMemberKeys =
  (keys: Keyset): Transform =>
  state => {
    return {
      ...state,
      members: state.members.map(member => {
        if (member.userId === keys.name) {
          return {
            ...member,
            keys, // 🡐 replace keys with new ones
          }
        } else return member
      }),
    }
  }
