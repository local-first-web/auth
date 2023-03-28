import { UserWithSecrets } from './types'
import { redactKeys } from '/keyset'
import { User } from '/user'

export const redactUser = (user: User | UserWithSecrets): User => {
  const { userId, userName } = user
  return {
    userId,
    userName,
    keys: redactKeys(user.keys),
  }
}
