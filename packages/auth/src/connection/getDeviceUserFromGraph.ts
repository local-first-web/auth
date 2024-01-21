import type { Base58, Keyring, KeysetWithSecrets, UserWithSecrets } from '@localfirst/crdx'
import { KeyType } from 'util/index.js'
import { assert } from '@localfirst/shared'
import { getTeamState } from '../team/getTeamState.js'
import * as select from '../team/selectors/index.js'

const { USER } = KeyType

export const getDeviceUserFromGraph = ({
  serializedGraph,
  teamKeyring,
  starterKeys,
  invitationId,
}: {
  serializedGraph: Uint8Array
  teamKeyring: Keyring
  starterKeys: KeysetWithSecrets
  invitationId: Base58
}): UserWithSecrets => {
  const state = getTeamState(serializedGraph, teamKeyring)

  const { userId } = select.getInvitation(state, invitationId)
  assert(userId) // since this is a device invitation the invitation info includes the userId that created it

  const { userName } = select.member(state, userId)
  assert(userName) // this user must exist in the team graph

  const userKeys = select.keys(state, starterKeys, { type: USER, name: userId })

  return {
    userName,
    userId,
    keys: userKeys,
  }
}
