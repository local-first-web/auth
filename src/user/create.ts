import * as keyset from '/keyset'
import { loadKeyset, storeKeyset } from '/storage'
import { LocalUser } from '/user/types'

const { MEMBER } = keyset.KeyType

export const create = (userName: string): LocalUser => {
  const existingKeys = loadKeyset(userName)
  if (existingKeys !== undefined)
    throw new Error(`There is already a keyset for user '${userName}'`)
  const keys = keyset.create({ type: MEMBER, name: userName })
  storeKeyset(userName, keys)
  return { userName, keys }
}
