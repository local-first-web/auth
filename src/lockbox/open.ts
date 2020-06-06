import { asymmetric } from '/crypto'
import { Keys } from '/keys'
import { Lockbox } from '/lockbox/types'

//TODO: Memoize this
export const open = (lockbox: Lockbox, decryptionKeys: Keys): Keys => {
  const { encryptionKey, encryptedPayload } = lockbox

  const keys = JSON.parse(
    asymmetric.decrypt(
      encryptedPayload,
      encryptionKey.publicKey,
      decryptionKeys.encryption.secretKey
    )
  )

  return keys
}
