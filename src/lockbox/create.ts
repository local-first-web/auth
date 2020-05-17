import { asymmetric } from '/crypto'
import { hasSecrets, KeysetWithSecrets, redactKeys } from '/keys'
import { Payload } from '/lib'
import { Lockbox } from '/lockbox/types'
import { User, UserWithSecrets } from '/user'

/** Creates a new lockbox that can be opened using sender's public key and recipient's private key. */
export const create = (args: {
  scope?: string
  senderKeys: KeysetWithSecrets
  recipient: User | UserWithSecrets
  secret: Payload
}): Lockbox => {
  const { senderKeys, recipient, secret, scope } = args

  const recipientPublicKeys = hasSecrets(recipient.keys)
    ? redactKeys(recipient.keys)
    : recipient.keys

  return {
    scope,
    senderPublicKey: senderKeys.asymmetric.publicKey,
    recipient: recipient.userName,
    recipientPublicKey: recipientPublicKeys.encryption,
    encryptedSecret: asymmetric.encrypt(
      secret,
      recipientPublicKeys.encryption,
      senderKeys.asymmetric.secretKey
    ),
  }
}
