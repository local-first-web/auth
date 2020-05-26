import { Base64Keypair, Base64 } from '/lib'

export interface KeysetWithSecrets {
  seed: Base64
  signature: Base64Keypair
  encryption: Base64Keypair
  generation?: number

  symmetric: { key: Base64 } // TODO: DEPRECATED
}

export interface PublicKeyset {
  signature: Base64 // = signature.publicKey
  encryption: Base64 // = encryption.publicKey
  generation?: number
}

export const hasSecrets = (keys: PublicKeyset | KeysetWithSecrets): keys is KeysetWithSecrets => {
  return keys.hasOwnProperty('symmetric')
}
