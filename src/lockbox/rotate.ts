import { KeysetWithSecrets } from '/keyset'
import { Lockbox } from '/lockbox/types'
import { create } from '/lockbox/create'

/**
 * "Rotating" a lockbox means replacing the keys it contains with new ones.
 *
 * For example, if the admin keys are compromised, we'll need to come up with a new set of keys;
 * then we'll need to find every lockbox that contained the old keys, and replace them with the new
 * ones.
 *
 * ```js
 * const newAdminKeys = keyset.create({ type: ROLE, name: ADMIN })
 * const newAdminLockboxForAlice = lockbox.rotate(adminLockboxForAlice, newAdminKeys)
 * ```
 */
export const rotate = (oldLockbox: Lockbox, contents: KeysetWithSecrets): Lockbox => {
  // make sure new keys have the same type and name as the old lockbox
  if (contents.type !== oldLockbox.contents.type || contents.name !== oldLockbox.contents.name)
    throw new Error('The type and name of the new contents must match those of the old lockbox')

  // increment the keys' generation index
  const prevGeneration = oldLockbox.contents.generation ?? 0
  const newContents = {
    ...contents,
    generation: prevGeneration + 1,
  }

  const newLockbox = create(newContents, oldLockbox.recipient)
  return newLockbox
}
