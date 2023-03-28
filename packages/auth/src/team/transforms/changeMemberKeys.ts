import { Keyset } from '@localfirst/crdx'
import { Transform } from '@/team/types'

export const changeMemberKeys =
  (keys: Keyset): Transform =>
  state => {
    return {
      ...state,
      members: state.members.map(member =>
        member.userId === keys.name
          ? {
              ...member,
              keys, // 🡐 replace keys with new ones
            }
          : member
      ),
    }
  }
