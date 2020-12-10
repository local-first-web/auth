import { asymmetric } from '@herbcaudill/crypto'
import memoize from 'fast-memoize'
import { KeysetWithSecrets } from '/keyset'
import { Lockbox } from '/lockbox/types'

export const open = memoize(
  (lockbox: Lockbox, decryptionKeys: KeysetWithSecrets): KeysetWithSecrets => {
    const { encryptionKey, encryptedPayload } = lockbox

    const keys = JSON.parse(
      asymmetric.decrypt({
        cipher: encryptedPayload,
        senderPublicKey: encryptionKey.publicKey,
        recipientSecretKey: decryptionKeys.encryption.secretKey,
      })
    )

    return keys
  }
)
