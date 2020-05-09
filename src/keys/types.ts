import { Base64Keypair, Base64 } from '../lib/types'

export interface KeysetWithSecrets {
  seed: Base64
  signature: Base64Keypair
  asymmetric: Base64Keypair
  symmetric: { key: Base64 }
  generation?: number
}

// TODO could we just have signature & encryption keys, and use the the asymmetric secret key as the
// symmetric key?
export interface KeysetWithSecrets2 {
  seed: Base64
  signature: Base64Keypair
  encryption: Base64Keypair
  generation?: number
}

export interface PublicKeyset {
  signature: Base64 // = signature.publicKey
  encryption: Base64 // = asymmetric.publicKey
  generation?: number
}

export const hasSecrets = (
  keys: PublicKeyset | KeysetWithSecrets
): keys is KeysetWithSecrets => {
  return keys.hasOwnProperty('symmetric')
}
