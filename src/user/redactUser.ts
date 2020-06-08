import { LocalUser } from '/user/types'
import { redact } from '/keyset'
import { Member } from '/member'

export const redactUser = (user: Member | LocalUser) =>
  ({
    ...user,
    keys: redact(user.keys),
  } as Member)
