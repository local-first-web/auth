import { truncateHashes } from '@/util'
import { Keyset, KeysetWithSecrets } from 'crdx'

export const keysetSummary = (keyset: Keyset | KeysetWithSecrets) => {
  const { name, generation, encryption } = keyset
  const publicKey = 'publicKey' in encryption ? encryption.publicKey : encryption
  return `${name}(${truncateHashes(publicKey)})#${generation}`
}
