import { asymmetric } from '/crypto'
import { generateKeys, KeysetScope, KeysetWithSecrets, PublicKeyset, redactKeys } from '/keys'
import { KeyManifest, Lockbox, isKeyManifest } from '/lockbox/types'

/** Creates a new lockbox that can be opened using the recipient's private key. */
export const create = (
  contents: KeysetWithSecrets,
  recipientKeys: KeysetWithSecrets | PublicKeyset | KeyManifest
): Lockbox => {
  // Don't leak the recipient's secrets if we have them
  const redactedRecipientKeys: PublicKeyset | KeyManifest = isKeyManifest(recipientKeys)
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
      scope: KeysetScope.EPHEMERAL,
      name: KeysetScope.EPHEMERAL,
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

export const rotate = (oldLockbox: Lockbox, newContents: KeysetWithSecrets): Lockbox => {
  // make sure new keys have the same scope and name as the old lockbox
  if (
    newContents.scope !== oldLockbox.contents.scope ||
    newContents.name !== oldLockbox.contents.name
  )
    throw new Error('The scope and name of the new contents must match those of the old lockbox')

  // increment the keys' generation index
  const prevGeneration = oldLockbox.contents.generation || 0
  const contents = {
    ...newContents,
    generation: prevGeneration + 1,
  }

  const newLockbox = create(contents, oldLockbox.recipient)
  return newLockbox
}
