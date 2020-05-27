import { asymmetric } from '/crypto'
import {
  generateKeys,
  hasSecrets,
  redactKeys,
  KeysetScope,
  KeysetWithSecrets,
  PublicKeyset,
} from '/keys'
import { Lockbox } from '/lockbox/types'
import { User, UserWithSecrets } from '/user'

/**
 * Creates a new lockbox that can be opened using the recipient's private key.
 */
export const create = (args: {
  encryptedKey: KeysetWithSecrets
  decryptionKey: KeysetWithSecrets | PublicKeyset
}): Lockbox => {
  const { encryptedKey, decryptionKey } = args

  const recipientPublicKeys = hasSecrets(decryptionKey) ? redactKeys(decryptionKey) : decryptionKey

  // We generate a new single-use keypair to encrypt the lockbox with
  const ephemeralKeys = generateKeys().encryption

  const encryptedPayload = asymmetric.encrypt(
    encryptedKey.seed,
    recipientPublicKeys.encryption,
    ephemeralKeys.secretKey
  )

  return {
    encryptionKey: {
      scope: KeysetScope.EPHEMERAL,
      publicKey: ephemeralKeys.publicKey,
    },
    decryptionKey: {
      ...recipientPublicKeys,
      publicKey: recipientPublicKeys.encryption,
    },
    encryptedKey: {
      ...encryptedKey,
      publicKey: encryptedKey.encryption.publicKey,
    },
    encryptedPayload,
  }
}
