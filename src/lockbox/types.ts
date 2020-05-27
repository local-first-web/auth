import { KeyMetadata, KeysetScope } from '/keys'
import { Base64 } from '/lib'

interface KeyManifest extends KeyMetadata {
  publicKey: Base64
}

export interface Lockbox {
  /** The public half of the keys used to encrypt this lockbox  */
  encryptionKey: Pick<KeyManifest, 'scope' | 'publicKey'> & {
    scope: KeysetScope.EPHEMERAL
  }

  /** Manifest for the keyset that can open this lockbox (the lockbox recipient's keys) */
  decryptionKey: KeyManifest & {
    scope: KeysetScope // required
    name: string //required
  }

  /** Manifest for the keyset that is in this lockbox (the lockbox contents) */
  encryptedKey: KeyManifest & {
    scope: KeysetScope // required
    name: string //required
  }

  /** The encrypted secret that can be used to regenerate the keyset */
  encryptedPayload: Base64
}
