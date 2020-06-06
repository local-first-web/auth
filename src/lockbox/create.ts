import { asymmetric } from '/crypto'
import { EPHEMERAL_SCOPE, generateKeys, Keys, PublicKeys, redactKeys } from '/keys'
import { isKeyManifest, KeyManifest, Lockbox } from '/lockbox/types'

/** Creates a new lockbox that can be opened using the recipient's private key. */
export const create = (contents: Keys, recipientKeys: Keys | PublicKeys | KeyManifest): Lockbox => {
  // Don't leak the recipient's secrets if we have them
  const redactedRecipientKeys: PublicKeys | KeyManifest = isKeyManifest(recipientKeys)
    ? recipientKeys
    : redactKeys(recipientKeys)

  // Don't leak secrets from the contents
  const redactedContents = redactKeys(contents)

  // Generate a new single-use keypair to encrypt the lockbox with
  const encryptionKeys = generateKeys().encryption

  const recipientPublicKey = isKeyManifest(redactedRecipientKeys)
    ? redactedRecipientKeys.publicKey
    : redactedRecipientKeys.encryption

  // Encrypt the lockbox's contents
  const encryptedPayload = asymmetric.encrypt(
    contents,
    recipientPublicKey,
    encryptionKeys.secretKey
  )

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
