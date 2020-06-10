import { User } from './types'
import * as keyset from '/keyset'
import { Member } from '/member'

export const redact = (user: Member | User) => {
  return {
    ...user,
    keys: keyset.redact(user.keys),
  } as Member
}
