import { asymmetric } from '/crypto'
import { generateKeys, KeysetScope } from '/keys'
import { KeysetMap, TeamState } from '/team/types'
import { UserWithSecrets } from '/user'
import { memberHasRole, memberIsAdmin } from './memberHasRole'
import { open } from '/lockbox'

// NEXT: This needs to be generalized so that we start with a device key, use it to open the user
// lockbox to get the user key, then open role keys, then if we're admin open all the other role
// keys, then open the team key

/** Returns all keysets from the given user's lockboxes in a structure that looks like this:
 * ```ts
 * {
 *    TEAM: {
 *      "Spies Я Us": { ... }
 *    },
 *    ROLE: {
 *      admin: { ... }
 *      managers: { ... }
 *    },
 * }
 * ```
 */
export const getKeys = (state: TeamState, user: UserWithSecrets): KeysetMap => {
  const userKeys = user.keys.encryption
  const keysets: KeysetMap = {}
  const userLockboxes = state.lockboxes[user.userName]
  if (userLockboxes) {
    const lockboxes = userLockboxes[userKeys.publicKey]

    for (const lockbox of lockboxes) {
      const { contents } = lockbox

      const { scope, name } = contents

      // If this is a role lockbox, make sure member is currently in this role
      // > WARNING: This is a superficial measure and doesn't actually prevent access to the
      // lockbox. If a member has been removed from a role, then the keys should have been rotated
      // by now and the member should not have the latest generation of lockbox.
      const memberShouldNoLongerHaveAccessToLockbox =
        scope === KeysetScope.ROLE &&
        !(memberIsAdmin(state, user.userName) || memberHasRole(state, user.userName, name))

      if (!memberShouldNoLongerHaveAccessToLockbox) {
        const keyset = open(lockbox, user.keys)

        // Add this to keysets for this scope
        keysets[scope] = {
          ...(keysets[scope] || {}),
          [name]: keyset,
        }
      }
    }
  }
  return keysets
}
