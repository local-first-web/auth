import { randomKey } from '@herbcaudill/crypto'
import * as keyset from '@/keyset'
import { User } from '@/user/types'

const { DEVICE, MEMBER } = keyset.KeyType

/**
 * Creates a new local user, with randomly-generated keys.
 *
 * @param userName The local user's user name.
 * @param seed (optional) A seed for generating keys. This is typically only used for testing
 * purposes, to ensure predictable data.
 */
export const create = (userName: string, seed: string = randomKey()): User => ({
  userName,
  keys: keyset.create({ type: MEMBER, name: userName }, seed),
})
