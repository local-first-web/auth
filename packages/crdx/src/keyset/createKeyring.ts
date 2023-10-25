import { isKeyring, isKeyset, type Keyring, type KeysetWithSecrets } from './types.js'

export const createKeyring = (keys: Keyring | KeysetWithSecrets | KeysetWithSecrets[]): Keyring => {
  if (isKeyring(keys)) return keys
  if (isKeyset(keys)) keys = [keys]
  return Object.fromEntries(keys.map<Keyring>(keyset => [keyset.encryption.publicKey, keyset]))
}
