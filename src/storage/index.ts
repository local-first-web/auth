import { KeysetWithSecrets } from '/keyset'
const STORAGE_KEY = 'TACO_KEY_STORAGE'

const storage = localStorage // TODO - replace with device secure storage, or password-protected browser storage

export const loadKeyset = (userName: string): KeysetWithSecrets | undefined => {
  const allKeysets = getKeysets()
  return allKeysets[userName]
}

export const storeKeyset = (userName: string, keys: KeysetWithSecrets) => {
  const allKeysets = getKeysets()
  allKeysets[userName] = keys
  storage.setItem(STORAGE_KEY, JSON.stringify(allKeysets))
}

const getKeysets = () => JSON.parse(storage.getItem(STORAGE_KEY) || '{}')
