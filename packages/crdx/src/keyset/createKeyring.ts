import { isKeyring, isKeyset, Keyring, KeysetWithSecrets } from './types'

export const createKeyring = (keys: Keyring | KeysetWithSecrets | KeysetWithSecrets[]): Keyring => {
  if (isKeyring(keys)) return keys
  if (isKeyset(keys)) keys = [keys]
  return keys.reduce(
    (keyring, keyset) => ({
      ...keyring,
      [keyset.encryption.publicKey]: keyset,
    }),
    {} as Keyring
  )
}
