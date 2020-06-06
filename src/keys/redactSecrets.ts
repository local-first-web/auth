import { Keys, PublicKeys, hasSecrets } from '/keys/types'

/**
 * Takes a keyset that includes secret keys, and returns just the public keys. (If the keyset provided doesn't include secret keys, it is returned as-is)
 * @param keys a keyset of the form `{signature: {secretKey, publicKey}, encryption: {secretKey, publicKey}}`
 * @returns a set of public keys of the form `{signature (publicKey), encryption (publicKey)}`
 */
export const redactKeys = (keys: Keys | PublicKeys): PublicKeys =>
  (!hasSecrets(keys)
    ? keys
    : {
        type: keys.type,
        name: keys.name,
        generation: keys.generation,
        encryption: keys.encryption.publicKey,
        signature: keys.signature.publicKey,
      }) as PublicKeys
