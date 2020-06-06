import { PublicKeys, KeysWithSecrets, KeyMetadata, KeyScope } from '/keys'
import { Base64 } from '/lib'

export type KeyManifest = KeyMetadata & {
  publicKey: Base64
}

// type guard
export const isKeyManifest = (
  keys: PublicKeys | KeysWithSecrets | KeyManifest
): keys is KeyManifest => {
  return keys.hasOwnProperty('publicKey')
}

export interface Lockbox {
  /** The public key of the keypair used to encrypt this lockbox  */
  encryptionKey: {
    scope: KeyScope.EPHEMERAL
    publicKey: Base64
  }

  /** Manifest for the keyset that can open this lockbox (the lockbox recipient's keys) */
  recipient: KeyManifest

  /** Manifest for the keyset that is in this lockbox (the lockbox contents) */
  contents: KeyManifest

  /** The encrypted keyset */
  encryptedPayload: Base64
}
