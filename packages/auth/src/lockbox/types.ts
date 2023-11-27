import {
  type Base58,
  type KeyMetadata,
  type Keyset,
  type KeysetWithSecrets,
} from '@localfirst/crdx'

export type KeyManifest = KeyMetadata & {
  publicKey: Base58
}

// Type guard
export const isKeyManifest = (
  keys: Keyset | KeysetWithSecrets | KeyManifest
): keys is KeyManifest => keys.hasOwnProperty('publicKey')

export type Lockbox = {
  /** The public key of the keypair used to encrypt this lockbox  */
  encryptionKey: {
    type: 'EPHEMERAL'
    publicKey: Base58
  }

  /** Manifest for the keyset that can open this lockbox (the lockbox recipient's keys) */
  recipient: KeyManifest

  /** Manifest for the keyset that is in this lockbox (the lockbox contents) */
  contents: KeyManifest

  /** The encrypted keyset */
  encryptedPayload: Uint8Array
}
