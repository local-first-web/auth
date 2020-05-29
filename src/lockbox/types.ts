import { KeyMetadata, KeysetScope } from '/keys'
import { Base64 } from '/lib'

type KeyManifest = KeyMetadata & {
  publicKey: Base64
}

export interface Lockbox {
  /** The public key of the keypair used to encrypt this lockbox  */
  encryptionKey: {
    scope: KeysetScope.EPHEMERAL
    publicKey: Base64
  }

  /** Manifest for the keyset that can open this lockbox (the lockbox recipient's keys) */
  recipient: KeyManifest & {
    scope: KeysetScope // required
  }

  /** Manifest for the keyset that is in this lockbox (the lockbox contents) */
  contents: KeyManifest & {
    scope: KeysetScope // required
  }

  /** The encrypted keyset */
  encryptedPayload: Base64
}
