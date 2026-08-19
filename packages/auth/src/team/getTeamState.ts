import type { Keyring } from '@localfirst/crdx'
import { assertLinksAreWellFormed } from './checkPayload.js'
import { deserializeTeamGraph } from './serialize.js'
import { teamMachine } from './teamMachine.js'

export const getTeamState = (serializedGraph: Uint8Array, keyring: Keyring) => {
  const graph = deserializeTeamGraph(serializedGraph, keyring)

  // This is a door like `Team.merge` is: the graph comes from whoever is admitting us, and
  // `teamMachine` runs the same resolver and reducer over it. Both callers reach it with the graph
  // off an ACCEPT_INVITATION message — `getDeviceUserFromGraph`, and the `joinedTheRightTeam` guard
  // in `Connection`. There's no backstop below this: `makeMachine` calls crdx's `validate` and
  // discards what it says.
  assertLinksAreWellFormed(graph)

  return teamMachine(graph)
}
