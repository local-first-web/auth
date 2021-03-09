import { hasSecrets, KeysetWithSecrets, PublicKeyset } from '@/keyset/types'
import { getScope } from '@/keyset/getScope'

import { debug } from './debug'

const log = debug('lf:sigkey')

// ignore coverage
export const keysetSummary = (keyset: PublicKeyset | KeysetWithSecrets | undefined) => {
  if (keyset === undefined) return 'none'
  const scope = getScope(keyset)
  const encKey = hasSecrets(keyset) ? keyset.encryption.publicKey : keyset.encryption
  const sigKey = hasSecrets(keyset) ? keyset.signature.publicKey : keyset.signature
  return `${scope.name}(e)${encKey.slice(0, 5)}(s)${sigKey.slice(0, 5)}#${keyset.generation}`
}

export const logSigKey = (
  message: string,
  keyset: PublicKeyset | KeysetWithSecrets | undefined
) => {
  if (keyset === undefined) return
  const scope = getScope(keyset)
  const signaturePublicKey = hasSecrets(keyset) ? keyset.signature.publicKey : keyset.signature
  const summary = `${scope.name}:${signaturePublicKey.slice(0, 5)}#${keyset.generation}`
  log(`${message}; ${summary}`)
}
