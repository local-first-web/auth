import { truncateHashes } from '@/util'
import { Keyset, KeysetWithSecrets } from 'crdx'

export const keysetSummary = (keyset: Keyset | KeysetWithSecrets) => {
  const { name, generation, encryption } = keyset
  const publicKey = typeof encryption === 'string' ? encryption : encryption.publicKey
  return `${name}(${truncateHashes(publicKey)})#${generation}`
}
