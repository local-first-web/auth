import { asymmetric } from '/crypto'
import { KeysetWithSecrets } from '/keyset'
import { Lockbox } from '/lockbox/types'

//TODO: Memoize this
export const open = (lockbox: Lockbox, decryptionKeys: KeysetWithSecrets): KeysetWithSecrets => {
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
