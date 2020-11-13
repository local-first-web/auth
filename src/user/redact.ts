import { User } from '/user'
import * as keyset from '/keyset'
import { Member } from '/member'

export const redactUser = (user: Member | User) => {
  const { userName } = user
  return {
    userName,
    keys: keyset.redactKeys(user.keys),
  } as Member
}
