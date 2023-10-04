﻿import { isKeyManifest, KeyManifest, Lockbox } from '@/lockbox/types.js'
import { asymmetric } from '@herbcaudill/crypto'
import { EPHEMERAL_SCOPE, Keyset, KeysetWithSecrets, redactKeys } from 'crdx'

/** Creates a new lockbox that can be opened using the recipient's private key. */
export const create = (
  contents: KeysetWithSecrets,
  recipientKeys: KeysetWithSecrets | Keyset | KeyManifest
): Lockbox => {
  // Don't leak the recipient's secrets if we have them
  const redactedRecipientKeys: Keyset | KeyManifest = isKeyManifest(recipientKeys)
    ? recipientKeys
    : redactKeys(recipientKeys)

  // Don't leak secrets from the contents
  const redactedContents = redactKeys(contents)

  // Generate a new single-use keypair to encrypt the lockbox with
  const encryptionKeys = asymmetric.keyPair()
  const recipientPublicKey = isKeyManifest(redactedRecipientKeys)
    ? redactedRecipientKeys.publicKey
    : redactedRecipientKeys.encryption

  // Encrypt the lockbox's contents
  const encryptedPayload = asymmetric.encrypt({
    secret: contents,
    recipientPublicKey: recipientPublicKey,
    senderSecretKey: encryptionKeys.secretKey,
  })

  const lockbox = {
    encryptionKey: {
      ...EPHEMERAL_SCOPE,
      publicKey: encryptionKeys.publicKey,
    },
    recipient: {
      ...redactedRecipientKeys,
      publicKey: recipientPublicKey,
    },
    contents: {
      ...redactedContents,
      publicKey: contents.encryption.publicKey,
    },
    encryptedPayload,
  } as Lockbox

  return lockbox
}
