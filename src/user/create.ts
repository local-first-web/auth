import { KeyType, newKeys } from '/keys'
import { loadKeyset, storeKeyset } from '/storage'
import { LocalUser } from '/user/types'

export const create = (userName: string): LocalUser => {
  const existingKeys = loadKeyset(userName)
  if (existingKeys !== undefined)
    throw new Error(`There is already a keyset for user '${userName}'`)
  const keys = newKeys({ type: KeyType.MEMBER, name: userName })
  storeKeyset(userName, keys)
  return { userName, keys }
}
