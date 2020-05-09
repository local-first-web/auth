import { KeysetWithSecrets, PublicKeyset } from './types'

/**
 * Takes a keyset that includes secret keys, and returns just the public keys.
 * @param keys a keyset of the form `{signature, asymmetric, symmetric}`
 * @returns a set of public keys of the form `{signature, encryption}`
 */
export const redactKeys = (keys: KeysetWithSecrets): PublicKeyset => ({
  encryption: keys.asymmetric.publicKey,
  signature: keys.signature.publicKey,
  generation: keys.generation,
})
