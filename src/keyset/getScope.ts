import { KeyScope, KeysetWithSecrets, PublicKeyset } from '/keyset/types'

export const getScope = (keyset: KeyScope | KeysetWithSecrets | PublicKeyset): KeyScope => ({
  type: keyset.type,
  name: keyset.name,
})
