import { deriveKeys, KeysetWithSecrets, randomKey } from '/keys'
import { storeKeyset, loadKeyset } from '/storage'
import { UserWithSecrets } from '/user/types'

export const create = (name: string): UserWithSecrets => {
  const existingKeys = loadKeyset(name)
  if (existingKeys !== undefined) throw new Error(`There is already a keyset for user '${name}'`)
  const keys = generateNewKeyset()
  storeKeyset(name, keys)
  return { userName: name, keys }
}

const generateNewKeyset = (): KeysetWithSecrets => deriveKeys(randomKey())
