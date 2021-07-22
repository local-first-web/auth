﻿import { PublicKeyset, KeysetWithSecrets, KeyMetadata, KeyType } from '@/keyset'
import { Base58 } from '@/util'

export type KeyManifest = KeyMetadata & {
  publicKey: Base58
}

// type guard
export const isKeyManifest = (
  keys: PublicKeyset | KeysetWithSecrets | KeyManifest
): keys is KeyManifest => {
  return keys.hasOwnProperty('publicKey')
}

export interface Lockbox {
  /** The public key of the keypair used to encrypt this lockbox  */
  encryptionKey: {
    type: KeyType.EPHEMERAL
    publicKey: Base58
  }

  /** Manifest for the keyset that can open this lockbox (the lockbox recipient's keys) */
  recipient: KeyManifest

  /** Manifest for the keyset that is in this lockbox (the lockbox contents) */
  contents: KeyManifest

  /** The encrypted keyset */
  encryptedPayload: Base58
}
