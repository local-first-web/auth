import { Lockbox } from '/lockbox/types'
import { KeysetWithSecrets, generateKeys } from '/keys'
import { asymmetric } from '/crypto'

export const open = (lockbox: Lockbox, decryptionKeys: KeysetWithSecrets): KeysetWithSecrets => {
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
