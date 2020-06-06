import { KeysWithSecrets } from '/keys'
const STORAGE_KEY = 'TACO_KEY_STORAGE'

const storage = localStorage // TODO - replace with device secure storage, or password-protected browser storage

export const loadKeyset = (userName: string): KeysWithSecrets | undefined => {
  const allKeysets = getKeysets()
  return allKeysets[userName]
}

export const storeKeyset = (userName: string, keys: KeysWithSecrets) => {
  const allKeysets = getKeysets()
  allKeysets[userName] = keys
  storage.setItem(STORAGE_KEY, JSON.stringify(allKeysets))
}

const getKeysets = () => JSON.parse(storage.getItem(STORAGE_KEY) || '{}')
