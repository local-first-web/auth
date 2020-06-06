import { asymmetric } from '/crypto'
import { KeysWithSecrets } from '/keys'
import { Lockbox } from '/lockbox/types'

//TODO: Memoize this
export const open = (lockbox: Lockbox, decryptionKeys: KeysWithSecrets): KeysWithSecrets => {
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
