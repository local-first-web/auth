import { Lockbox } from '@/lockbox/types'
import { memoize } from '@/util'
import { asymmetric } from '@herbcaudill/crypto'
import { KeysetWithSecrets } from 'crdx'

export const open = memoize(
  (lockbox: Lockbox, decryptionKeys: KeysetWithSecrets): KeysetWithSecrets => {
    const { encryptionKey, encryptedPayload } = lockbox

    const decrypted = asymmetric.decrypt({
      cipher: encryptedPayload,
      senderPublicKey: encryptionKey.publicKey,
      recipientSecretKey: decryptionKeys.encryption.secretKey,
    })
    const keys = decrypted as unknown as KeysetWithSecrets

    return keys
  },
)
