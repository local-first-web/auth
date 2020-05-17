import { asymmetric } from '/crypto'
import { deriveKeys, hasSecrets, redactKeys } from '/keys'
import { Lockbox } from '/lockbox/types'
import { User, UserWithSecrets } from '/user'

/** Creates a new lockbox that can be opened using sender's public key and recipient's private key. */
export const create = (args: { scope: string; secret: string; recipient: User | UserWithSecrets }): Lockbox => {
  const { scope, secret, recipient } = args

  const recipientPublicKeys = hasSecrets(recipient.keys) ? redactKeys(recipient.keys) : recipient.keys

  const keyset = deriveKeys(secret)

  return {
    scope,
    senderPublicKey: keyset.asymmetric.publicKey,
    recipient: recipient.userName,
    recipientPublicKey: recipientPublicKeys.encryption,
    encryptedSecret: asymmetric.encrypt(secret, recipientPublicKeys.encryption, keyset.asymmetric.secretKey),
  }
}
