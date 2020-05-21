import { asymmetric } from '/crypto'
import { deriveKeys } from '/keys'
import { keyToString } from '/lib'
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
  if (!role) throw new Error(`A role called  '${roleName}' was not found`)
  return role
}

export const getKeys = (state: TeamState, user: UserWithSecrets): KeysetMap => {
  const publicKey = keyToString(user.keys.asymmetric.publicKey)

  const keysets: KeysetMap = {}
  const userLockboxes = state.lockboxes[user.userName]
  if (userLockboxes) {
    const lockboxes = userLockboxes[publicKey]
    for (const lockbox of lockboxes) {
      const { scope, encryptedSecret, senderPublicKey } = lockbox
      const secret = asymmetric.decrypt(
        encryptedSecret,
        senderPublicKey,
        user.keys.asymmetric.secretKey
      )
      keysets[scope] = deriveKeys(secret)
    }
  }
  return keysets
}
