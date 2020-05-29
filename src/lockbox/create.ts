import { asymmetric } from '/crypto'
import { generateKeys, KeysetScope, KeysetWithSecrets, PublicKeyset, redactKeys } from '/keys'
import { Lockbox } from '/lockbox/types'

/** Creates a new lockbox that can be opened using the recipient's private key. */
export const create = (
  contents: KeysetWithSecrets,
  recipientKeys: KeysetWithSecrets | PublicKeyset
): Lockbox => {
  // Don't leak the recipient's secrets if we have them
  const redactedRecipientKeys = redactKeys(recipientKeys)

  // Don't leak secrets from the contents
  const redactedContents = redactKeys(contents)

  // Generate a new single-use keypair to encrypt the lockbox with
  const encryptionKeys = generateKeys().encryption

  // Encrypt the lockbox's contents
  const encryptedPayload = asymmetric.encrypt(
    contents,
    redactedRecipientKeys.encryption,
    encryptionKeys.secretKey
  )

  const lockbox = {
    encryptionKey: {
      scope: KeysetScope.EPHEMERAL,
      name: KeysetScope.EPHEMERAL,
      publicKey: encryptionKeys.publicKey,
    },
    recipient: {
      ...redactedRecipientKeys,
      publicKey: redactedRecipientKeys.encryption,
    },
    contents: {
      ...redactedContents,
      publicKey: contents.encryption.publicKey,
    },
    encryptedPayload,
  } as Lockbox

  return lockbox
}
