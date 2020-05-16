import { UserWithSecrets } from './types'
import { redactKeys } from '/keys'

export const redactUser = (user: UserWithSecrets) => ({
  ...user,
  keys: redactKeys(user.keys),
})
