import { deriveKeys, KeysetWithSecrets, randomKey } from '../keys'
import { UserWithSecrets } from './types'
import { loadKeyset, storeKeyset } from '../secureStorage'

export const getUser = (name: string): UserWithSecrets => {
  const keys = loadKeyset(name) || generateNewKeyset()
  storeKeyset(name, keys)
  return { name, keys }
}

const generateNewKeyset = (): KeysetWithSecrets => deriveKeys(randomKey())
