import { type Keyset, type KeysetWithSecrets } from '@localfirst/crdx'
import { create } from './create.js'
import { type Lockbox } from './types.js'
import { assertScopesMatch } from '../util/index.js'

/**
 * "Rotating" a lockbox means replacing the keys it contains with new ones.
 *
 * For example, if the admin keys are compromised, we'll need to come up with a new set of keys;
 * then we'll need to find every lockbox that contained the old keys, and make a replacement lockbox
 * for each one, containing the new keys.
 *
 * ```js
 * const newAdminKeys = createKeyset({ type: ROLE, name: ADMIN })
 * newAdminKeys.generation = adminKeys.generation + 1
 * const newAdminLockboxForAlice = lockbox.rotate({
 *   oldLockbox: adminLockboxForAlice,
 *   newContents: newAdminKeys,
 * })
 * ```
 *
 * The generation the new keys carry is the caller's to set, and `Team.rotateKeys` is what sets it.
 * A generation belongs to the scope, not to one lockbox: every recipient of a scope's keys has to
 * hold them under the same number, or a reader can't find them by the number a writer recorded.
 * This used to compute `oldLockbox.contents.generation + 1` per lockbox, which meant one lockbox
 * claiming to be ahead of the rest gave its own recipient a replacement several generations clear
 * of everyone else's.
 */
export const rotate = ({
  oldLockbox,
  newContents,
  updatedRecipientKeys,
}: rotateParameters): Lockbox => {
  // Make sure the new keys have the same scope as the old ones
  assertScopesMatch(newContents, oldLockbox.contents)

  // If we're given a new public key for the recipient
  if (updatedRecipientKeys) {
    assertScopesMatch(oldLockbox.recipient, updatedRecipientKeys)
  }

  // If we have updated keys for the recipient, use them; otherwise the recipient manifest is the same as before
  const recipientManifest = updatedRecipientKeys ?? oldLockbox.recipient

  // Make a new lockbox for the same recipient, but containing the new keys
  return create(newContents, recipientManifest)
}

type rotateParameters = {
  oldLockbox: Lockbox
  newContents: KeysetWithSecrets
  updatedRecipientKeys?: Keyset
}
