import { type KeysetWithSecrets } from '@localfirst/crdx'
import { asymmetric } from '@localfirst/crypto'
import { type Lockbox } from 'lockbox/types.js'
import { memoize } from 'util/index.js'

export const open = memoize(
  (lockbox: Lockbox, decryptionKeys: KeysetWithSecrets): KeysetWithSecrets => {
    const { encryptionKey, encryptedPayload } = lockbox

    const decrypted = asymmetric.decryptBytes({
      cipher: encryptedPayload,
      senderPublicKey: encryptionKey.publicKey,
      recipientSecretKey: decryptionKeys.encryption.secretKey,
    })
    const keys = decrypted as unknown as KeysetWithSecrets

    return keys
  }
)
