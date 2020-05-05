import { KeysetWithSecrets } from '../keys'
const STORAGE_KEY = 'TACO_KEY_STORAGE'

const storage = localStorage // TODO - replace with device secure storage, or password-protected browser storage

export const loadKeyset = (name: string): KeysetWithSecrets | undefined => {
  const allKeysets = getKeysets()
  return allKeysets[name]
}

export const storeKeyset = (name: string, keys: KeysetWithSecrets) => {
  const allKeysets = getKeysets()
  allKeysets[name] = keys
  storage.setItem(STORAGE_KEY, JSON.stringify(allKeysets))
}

const getKeysets = () => JSON.parse(storage.getItem(STORAGE_KEY) || '{}')
