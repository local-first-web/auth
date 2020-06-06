import { KeyType, newKeys } from '/keys'
import { loadKeyset, storeKeyset } from '/storage'
import { LocalUser } from '/user/types'

export const create = (name: string): LocalUser => {
  const existingKeys = loadKeyset(name)
  if (existingKeys !== undefined) throw new Error(`There is already a keyset for user '${name}'`)
  const keys = newKeys({ type: KeyType.MEMBER, name })
  storeKeyset(name, keys)
  return { name: name, keys }
}
