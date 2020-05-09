import { hasSecrets, redactKeys } from 'keys'
import { asymmetric, Payload } from '../lib'
import { User, UserWithSecrets } from '../user'
import { Lockbox } from './types'

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
    sender: sender.name,
    senderPublicKey: sender.keys.asymmetric.publicKey,
    recipient: recipient.name,
    recipientPublicKey: recipientPublicKeys.encryption,
    encryptedSecret: asymmetric.encrypt(
      secret,
      recipientPublicKeys.encryption,
      sender.keys.asymmetric.secretKey
    ),
  }
}
