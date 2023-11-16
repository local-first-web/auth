import type { Base58, Keyring, UserWithSecrets } from '@localfirst/crdx'
import type { FirstUseDeviceWithSecrets } from 'device/index.js'
import { KeyType, assert } from 'util/index.js'
import { getTeamState } from './getTeamState.js'
import * as select from './selectors/index.js'

const { USER } = KeyType

export const getUserForDeviceFromGraph = ({
  serializedGraph,
  keyring,
  device,
  invitationId,
}: {
  serializedGraph: string
  keyring: Keyring
  device: FirstUseDeviceWithSecrets
  invitationId: Base58
}): UserWithSecrets => {
  const state = getTeamState(serializedGraph, keyring)
  const { userId } = select.getInvitation(state, invitationId)
  assert(userId) // since this is a device invitation the invitation info includes the userId that created it
  const { userName } = select.member(state, userId)
  assert(userName) // this user must exist in the team graph
  const keys = select.keys(state, device.keys, { type: USER, name: userId })
  return {
    userName,
    userId,
    keys,
  }
}
