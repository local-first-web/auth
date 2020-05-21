import { asymmetric } from '/crypto'
import { deriveKeys, hasSecrets, redactKeys, randomKey } from '/keys'
import { Lockbox } from '/lockbox/types'
import { User, UserWithSecrets } from '/user'

/**
 * Creates a new lockbox that can be opened using the recipient's private key.
 */
export const create = (args: {
  scope: string
  secret: string
  recipient: User | UserWithSecrets
}): Lockbox => {
  const { scope, secret, recipient } = args

  const recipientPublicKeys = hasSecrets(recipient.keys)
    ? redactKeys(recipient.keys)
    : recipient.keys

  // We generate a new single-use keypair to encrypt the lockbox with
  const encryptionKeys = deriveKeys(randomKey()).asymmetric

  return {
    scope,
    publicKey: encryptionKeys.publicKey, // the public half of the encryption keys is publicly visible on the lockbox
    recipientPublicKey: recipientPublicKeys.encryption, // the public half of the recipient's keys is also visible, to help them locate the right one
    recipient: recipient.userName,
    encryptedSecret: asymmetric.encrypt(
      secret,
      recipientPublicKeys.encryption,
      encryptionKeys.secretKey
    ),
  }
}
