import { KeysetWithSecrets, PublicKeyset, hasSecrets } from '@/keyset/types'

/**
 * There are two kinds of keysets:
 *
 * - **`KeysetWithSecrets`** includes the secret keys (for example, our user or device keys, or keys
 *   for roles we belong to)
 * - **`PublicKeyset`** only includes the public keys (for example, other users' keys, or keys for
 *   roles we don't belong to)
 *
 * The `redact` function takes a `KeysetWithSecrets`, and returns a `PublicKeyset`.
 *
 * ```js
 * const adminPublicKeys = keyset.redactKeys(adminKeys)
 *
 * {
 *   // the metadata is unchanged
 *   type: 'ROLE',
 *   name: 'admin',
 *   generation: 0,
 *   // instead of keypairs, these are just the public keys
 *   signature: 'v44ZAwFgdPMXaS8vFEkqlvKfqf3wlhxS1WrpB7KAG7=', // = adminKeys.signature.publicKey
 *   encryption: 'XKLCZ4oO6KqfTnFFeY4kr3EKs0V98eSbSyUjDROxX=', // = adminKeys.encryption.publicKey
 * }
 * ```
 *
 * You can also pass in a `PublicKeyset`, in which case it will be returned as-is.
 */
export const redactKeys = (keys: KeysetWithSecrets | PublicKeyset): PublicKeyset =>
  (!hasSecrets(keys)
    ? keys
    : {
        type: keys.type,
        name: keys.name,
        generation: keys.generation,
        encryption: keys.encryption.publicKey,
        signature: keys.signature.publicKey,
      }) as PublicKeyset
