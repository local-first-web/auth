import { UserWithSecrets, User } from '/user/types'
import { redactKeys } from '/keys'

export const redactUser = (user: User | UserWithSecrets) => ({
  ...user,
  keys: redactKeys(user.keys),
})
