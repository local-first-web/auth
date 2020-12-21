import { Reducer } from '/team/reducers/index'
import { PublicKeyset } from '/keyset'
import { debug } from '/util'

const log = debug('lf:auth:reducer')

export const changeMemberKeys = (keys: PublicKeyset): Reducer => state => {
  log('changeMemberKeys %o', keys)
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
