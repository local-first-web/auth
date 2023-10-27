import { Keyring, KeysetWithSecrets } from './types'

export const getLatestGeneration = (keyring: Keyring) => {
  let latest: KeysetWithSecrets | undefined

  for (const publicKey in keyring) {
    const keyset = keyring[publicKey]
    if (latest === undefined || keyset.generation > latest.generation) {
      latest = keyset
    }
  }

  return latest
}
