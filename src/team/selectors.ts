import { asymmetric } from '/crypto'
import { deriveKeys } from '/keys'
import { LockboxScope } from '/lockbox'
import { ADMIN } from '/role'
import { KeysetMap, TeamState } from '/team/types'
import { UserWithSecrets } from '/user'

export const hasMember = (state: TeamState, userName: string) =>
  state.members.find(m => m.userName === userName) !== undefined

export const getMember = (state: TeamState, userName: string) => {
  const member = state.members.find(m => m.userName === userName)
  if (!member) throw new Error(`A member named '${userName}' was not found`)
  return member
}

export const memberHasRole = (state: TeamState, userName: string, role: string) => {
  const member = getMember(state, userName)
  return member.roles.includes(role)
}

export const memberIsAdmin = (state: TeamState, userName: string) =>
  memberHasRole(state, userName, ADMIN)

export const hasRole = (state: TeamState, roleName: string) =>
  state.roles.find(r => (r.roleName = roleName)) !== undefined

export const getRole = (state: TeamState, roleName: string) => {
  const role = state.roles.find(r => r.roleName === roleName)
  if (!role) throw new Error(`A role called '${roleName}' was not found`)
  return role
}

export const membersInRole = (state: TeamState, roleName: string) =>
  state.members.filter(member => member.roles.includes(roleName))

export const admins = (state: TeamState) => membersInRole(state, ADMIN)

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
  const userKeys = user.keys.asymmetric

  const keysets: KeysetMap = {}
  const userLockboxes = state.lockboxes[user.userName]
  if (userLockboxes) {
    const lockboxes = userLockboxes[userKeys.publicKey]
    for (const lockbox of lockboxes) {
      const { scope, name, encryptedSecret, publicKey } = lockbox

      // If this is a role lockbox, make sure member is currently in this role
      // > WARNING: This is a superficial measure and doesn't actually prevent access to the
      // lockbox. If a member has been removed from a role, then the keys should have been rotated
      // by now and the member should not have the latest generation of lockbox.
      const memberShouldNoLongerHaveAccessToLockbox =
        scope === LockboxScope.ROLE &&
        !(memberIsAdmin(state, user.userName) || memberHasRole(state, user.userName, name))

      if (!memberShouldNoLongerHaveAccessToLockbox) {
        // Decrypt the seed from the lockbox and use it to derive the keyset
        const seed = asymmetric.decrypt(encryptedSecret, publicKey, userKeys.secretKey)
        const keyset = deriveKeys(seed)

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
