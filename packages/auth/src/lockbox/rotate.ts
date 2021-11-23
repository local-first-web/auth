import { create } from '@/lockbox/create'
import { Lockbox } from '@/lockbox/types'
import { Keyset, KeysetWithSecrets } from 'crdx'
import { assertScopesMatch } from '@/util'

/**
 * "Rotating" a lockbox means replacing the keys it contains with new ones.
 *
 * For example, if the admin keys are compromised, we'll need to come up with a new set of keys;
 * then we'll need to find every lockbox that contained the old keys, and make a replacement lockbox
 * for each one, containing the new keys.
 *
 * ```js
 * const newAdminKeys = createKeyset({ type: ROLE, name: ADMIN })
 * const newAdminLockboxForAlice = lockbox.rotate(adminLockboxForAlice, newAdminKeys)
 * ```
 */
export const rotate = ({
  oldLockbox,
  newContents,
  updatedRecipientKeys,
}: rotateParams): Lockbox => {
  // Make sure the new keys have the same scope as the old ones
  assertScopesMatch(newContents, oldLockbox.contents)
  // If we're given a new public key for the recipient
  if (updatedRecipientKeys) assertScopesMatch(oldLockbox.recipient, updatedRecipientKeys)

  // the new keys have the next generation index
  newContents.generation = oldLockbox.contents.generation + 1

  // if we have updated keys for the recipient, use them; otherwise the recipient manifest is the same as before
  const recipientManifest = updatedRecipientKeys ?? oldLockbox.recipient

  // make a new lockbox for the same recipient, but containing the new keys
  return create(newContents, recipientManifest)
}

type rotateParams = {
  oldLockbox: Lockbox
  newContents: KeysetWithSecrets
  updatedRecipientKeys?: Keyset
}
