import { redactKeys, type Base58, type Keyset, type KeysetWithSecrets } from '@localfirst/crdx'
import { hash } from '@localfirst/crypto'
import { HashPurpose } from 'util/index.js'

/**
 * Fingerprints a public keyset, for the invitee to commit to in their proof of invitation.
 *
 * The fields are listed out rather than hashing the keyset object as it came, so that a keyset that
 * has been round-tripped through the graph fingerprints the same as the one the invitee signed.
 * Secret keys are stripped first, so it doesn't matter which form the caller happens to hold.
 */
export const hashKeys = (keys: Keyset | KeysetWithSecrets): Base58 => {
  const { type, name, generation, encryption, signature } = redactKeys(keys)
  return hash(HashPurpose.INVITEE_KEYS, {
    type,
    name,
    generation,
    encryption,
    signature,
  })
}
