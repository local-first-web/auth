import assert from 'assert'
import { KeyScope, KeysetWithSecrets, PublicKeyset } from '/keyset'
import { getScope } from '/keyset/getScope'
import { create } from '/lockbox/create'
import { Lockbox } from '/lockbox/types'
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
  assertScopesMatch(newContents, oldLockbox.contents)

  // the new keys have the next generation index
  newContents.generation = oldLockbox.contents.generation + 1

  // make a new lockbox for the same recipient, but containing the new keys
  const newLockbox = create(newContents, oldLockbox.recipient)
  return newLockbox
}

function assertScopesMatch(a: HasScope, b: HasScope) {
  const newScope = JSON.stringify(getScope(a))
  const oldScope = JSON.stringify(getScope(b))
  assert(
    oldScope === newScope,
    `The scope of the new keys must match those of the old lockbox. 
     New scope: ${newScope} 
     Old scope: ${oldScope}`
  )
}

type HasScope = KeyScope | KeysetWithSecrets | PublicKeyset
