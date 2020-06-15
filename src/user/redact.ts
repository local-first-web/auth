import { User } from '/user/types'
import * as keyset from '/keyset'
import { Member } from '/member'

export const redact = (user: Member | User) => {
  const { userName } = user
  return {
    userName,
    keys: keyset.redact(user.keys),
  } as Member
}
