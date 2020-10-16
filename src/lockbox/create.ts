import { asymmetric } from '/crypto'
import * as keyset from '/keyset'
import { KeysetWithSecrets, PublicKeyset } from '/keyset'
import { isKeyManifest, KeyManifest, Lockbox } from '/lockbox/types'

const { EPHEMERAL_SCOPE } = keyset

/** Creates a new lockbox that can be opened using the recipient's private key. */
export const create = (
  contents: KeysetWithSecrets,
  recipientKeys: KeysetWithSecrets | PublicKeyset | KeyManifest
): Lockbox => {
  // Don't leak the recipient's secrets if we have them
  const redactedRecipientKeys: PublicKeyset | KeyManifest = isKeyManifest(recipientKeys)
    ? recipientKeys
    : keyset.redact(recipientKeys)

  // Don't leak secrets from the contents
  const redactedContents = keyset.redact(contents)

  // Generate a new single-use keypair to encrypt the lockbox with
  const encryptionKeys = keyset.create(EPHEMERAL_SCOPE).encryption

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
