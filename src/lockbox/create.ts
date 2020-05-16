import { hasSecrets, redactKeys } from '/keys'
import { Payload } from '/lib'
import { User, UserWithSecrets } from '/user'
import { Lockbox } from './types'
import { asymmetric } from '/crypto'

/** Creates a new lockbox that can be opened using sender's public key and recipient's private key. */
export const create = (args: {
  scope?: string
  sender: UserWithSecrets
  recipient: User | UserWithSecrets
  secret: Payload
}): Lockbox => {
  const { sender, recipient, secret, scope } = args

  const recipientPublicKeys = hasSecrets(recipient.keys)
    ? redactKeys(recipient.keys)
    : recipient.keys

  return {
    scope,
    sender: sender.userName,
    senderPublicKey: sender.keys.asymmetric.publicKey,
    recipient: recipient.userName,
    recipientPublicKey: recipientPublicKeys.encryption,
    encryptedSecret: asymmetric.encrypt(
      secret,
      recipientPublicKeys.encryption,
      sender.keys.asymmetric.secretKey
    ),
  }
}
