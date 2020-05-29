import { KeysetWithSecrets, newKeys, KeysetScope } from '/keys'
import { loadKeyset, storeKeyset } from '/storage'
import { UserWithSecrets } from '/user/types'

export const create = (name: string): UserWithSecrets => {
  const existingKeys = loadKeyset(name)
  if (existingKeys !== undefined) throw new Error(`There is already a keyset for user '${name}'`)
  const keys = newKeys({ scope: KeysetScope.MEMBER, name, generation: 0 })
  storeKeyset(name, keys)
  return { userName: name, keys }
}
