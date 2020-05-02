import { KeysetWithSecrets, PublicKeyset } from './types'

export const redactSecrets = (keys: KeysetWithSecrets): PublicKeyset => ({
  encryption: keys.asymmetric.publicKey,
  signature: keys.signature.publicKey,
  generation: keys.generation,
})
