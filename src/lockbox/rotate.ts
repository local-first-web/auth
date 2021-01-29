import { KeysetWithSecrets } from '/keyset'
import { Lockbox } from '/lockbox/types'
import { create } from '/lockbox/create'
import assert from 'assert'
import { getScope } from '/keyset/getScope'
import * as R from 'ramda'
/**
 * "Rotating" a lockbox means replacing the keys it contains with new ones.
 *
 * For example, if the admin keys are compromised, we'll need to come up with a new set of keys;
 * then we'll need to find every lockbox that contained the old keys, and make a replacement lockbox
 * for each one, containing the new keys.
 *
 * ```js
 * const newAdminKeys = keyset.create({ type: ROLE, name: ADMIN })
 * const newAdminLockboxForAlice = lockbox.rotate(adminLockboxForAlice, newAdminKeys)
 * ```
 */
export const rotate = (oldLockbox: Lockbox, newContents: KeysetWithSecrets): Lockbox => {
  assert(
    R.equals(getScope(newContents), getScope(oldLockbox.contents)),
    'The scope (type and name) of the new keys must match those of the old lockbox'
  )

  // increment the keys' generation index
  newContents.generation = oldLockbox.contents.generation + 1

  // make a new lockbox and return that
  const newLockbox = create(newContents, oldLockbox.recipient)
  return newLockbox
}
