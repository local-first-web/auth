import type { Keyring } from '@localfirst/crdx'
import { assertLinksAreWellFormed } from './checkPayload.js'
import { deserializeTeamGraph } from './serialize.js'
import { teamMachine } from './teamMachine.js'

export const getTeamState = (serializedGraph: Uint8Array, keyring: Keyring) => {
  const graph = deserializeTeamGraph(serializedGraph, keyring)

  // This is a door like `Team.merge` is: the graph comes from whoever is admitting us, and
  // `teamMachine` runs the same resolver and reducer over it. Both callers reach it with the graph
  // off an ACCEPT_INVITATION message — `getDeviceUserFromGraph`, and the `joinedTheRightTeam` guard
  // in `Connection`. `makeMachine` does check the graph's integrity below this, but the resolver
  // walks payloads before any of that runs, so the shape is settled here.
  assertLinksAreWellFormed(graph)

  return teamMachine(graph)
}
