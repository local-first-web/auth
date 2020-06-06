import { LocalUser } from '/user/types'
import { redactKeys } from '/keys'
import { Member } from '/member'

export const redactUser = (user: Member | LocalUser) =>
  ({
    ...user,
    keys: redactKeys(user.keys),
  } as Member)
