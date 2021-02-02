import { hasSecrets, KeysetWithSecrets, PublicKeyset, getScope } from '/keyset'

export const keysetSummary = (keyset: PublicKeyset | KeysetWithSecrets | undefined) => {
  if (keyset === undefined) return 'none'
  const scope = getScope(keyset)
  const publicKey = hasSecrets(keyset) ? keyset.encryption.publicKey : keyset.encryption
  return `${scope.name}:${publicKey}`
}
