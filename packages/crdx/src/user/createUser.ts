import { createKeyset, KeyType } from '/keyset'
import { UserWithSecrets } from '/user/types'
import cuid from 'cuid'
import { randomKey } from '@localfirst/crypto'

/**
 * Creates a new local user, with randomly-generated keys.
 */
export const createUser = (userName: string, userId: string = cuid(), seed: string = randomKey()): UserWithSecrets => {
  return {
    userId,
    userName,
    keys: createKeyset({ type: KeyType.USER, name: userId }, seed),
  }
}
