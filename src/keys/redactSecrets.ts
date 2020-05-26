import { KeysetWithSecrets, PublicKeyset } from '/keys/types'

/**
 * Takes a keyset that includes secret keys, and returns just the public keys.
 * @param keys a keyset of the form `{signature: {secretKey, publicKey}, encryption: {secretKey, publicKey}}`
 * @returns a set of public keys of the form `{signature (publicKey), encryption (publicKey)}`
 */
export const redactKeys = (keys: KeysetWithSecrets): PublicKeyset => ({
  encryption: keys.encryption.publicKey,
  signature: keys.signature.publicKey,
  generation: keys.generation,
})
