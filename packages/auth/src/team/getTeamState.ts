import type { Keyring } from '@localfirst/crdx'
import { assertLinksAreWellFormed } from './checkPayload.js'
import { deserializeTeamGraph } from './serialize.js'
import { teamMachine } from './teamMachine.js'

export const getTeamState = (serializedGraph: Uint8Array, keyring: Keyring) => {
  const graph = deserializeTeamGraph(serializedGraph, keyring)

  // This is a door like `Team.merge` is: the graph comes from whoever is admitting us, and
  // `teamMachine` runs the same resolver and reducer over it. Both callers reach it with the graph
  // off an ACCEPT_INVITATION message — `getDeviceUserFromGraph`, and the `joinedTheRightTeam` guard
  // in `Connection`. `makeMachine` does refuse a structurally unreplayable graph below this, but
  // those rules are about hashes and predecessors and never look inside a payload — so nothing
  // below here settles the shapes the resolver and the reducer reach into.
  assertLinksAreWellFormed(graph)

  return teamMachine(graph)
}
