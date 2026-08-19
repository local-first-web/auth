import { getLatestGeneration, type Keyring, type UserWithSecrets } from '@localfirst/crdx'
import { assert } from '@localfirst/shared'
import { deriveId } from '../invitation/deriveId.js'
import { generateStarterKeys } from '../invitation/generateStarterKeys.js'
import { KeyType } from '../util/index.js'
import { getTeamState } from '../team/getTeamState.js'
import * as select from '../team/selectors/index.js'

const { USER } = KeyType

/**
 * If we're joining as a new device for an existing member, we don't have a user object yet, so we
 * need to get those from the graph. We use the invitation seed to generate the starter keys for the
 * new device. We can use these to unlock the lockboxes on the team graph that contain our user
 * keys.
 *
 * Because we need all previous user keys to decrypt the team graph, we return a keyring containing
 * the full history of user keys, along with a user object containing just the latest generation of
 * keys.
 */
export const getDeviceUserFromGraph = ({
  serializedGraph,
  teamKeyring,
  invitationSeed,
}: {
  serializedGraph: Uint8Array
  teamKeyring: Keyring
  invitationSeed: string
}): {
  user: UserWithSecrets
  userKeyring: Keyring
} => {
  const starterKeys = generateStarterKeys(invitationSeed)
  const invitationId = deriveId(invitationSeed)
  const state = getTeamState(serializedGraph, teamKeyring)

  const invitation = select.getInvitation(state, invitationId)
  assert(invitation.kind === 'DEVICE') // only a device invitation names the member it belongs to
  const { userId } = invitation

  const { userName } = select.member(state, userId)
  assert(userName) // this user must exist in the team graph

  const userKeyring = select.keyring(state, { type: USER, name: userId }, starterKeys)

  // An empty keyring means the starter keys derived from the invitation seed didn't open any of
  // this member's user lockboxes — the graph we were sent carries a device invitation for them,
  // but not the user keys that invitation is supposed to come with. There is nothing to do with
  // that but stop: every step after this one needs these keys.
  //
  // This is the only place that can say what went wrong, because it's the only place that knows
  // the keys were supposed to come from an invitation. Letting it through produced a
  // `UserWithSecrets` whose `keys` was undefined, which `Team` accepts without complaint; the
  // failure landed later in `Team.join` as `TypeError: Cannot read properties of undefined
  // (reading 'encryption')`, thrown from crdx's `append` while signing a link — three layers away,
  // naming neither the invitation nor the lockboxes.
  const keys = getLatestGeneration(userKeyring)
  assert(
    keys,
    `The invitation seed didn't open any user keys for member '${userId}'. The graph we were sent has the invitation on it, but not the lockboxes holding that member's user keys.`
  )

  const user = { userName, userId, keys }

  return { user, userKeyring }
}
