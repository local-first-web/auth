import { User } from '/user/types'
import * as keyset from '/keyset'
import { Member } from '/member'

export const redact = (user: Member | User) => {
  return {
    ...user,
    keys: keyset.redact(user.keys),
  } as Member
}
