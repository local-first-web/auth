import { UserWithSecrets, User } from 'user'
import { Payload } from 'lib/types'
import { asymmetric } from 'lib'
import { Lockbox } from './types'

/** Creates a new lockbox that can be opened using sender's public key and recipient's private key. */
export const create = (args: {
  scope?: string
  sender: UserWithSecrets
  recipient: User
  secret: Payload
}): Lockbox => {
  const { sender, recipient, secret, scope } = args
  return {
    scope,
    sender: sender.name,
    senderPublicKey: sender.keys.asymmetric.publicKey,
    recipient: recipient.name,
    recipientPublicKey: recipient.keys.encryption,
    encryptedSecret: asymmetric.encrypt(
      secret,
      recipient.keys.encryption,
      sender.keys.asymmetric.secretKey
    ),
  }
}
