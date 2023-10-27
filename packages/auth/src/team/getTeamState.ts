import type { Keyring } from '@localfirst/crdx'
import { deserializeTeamGraph } from './serialize.js'
import { teamMachine } from './teamMachine.js'

export const getTeamState = (serializedGraph: string, keyring: Keyring) => {
  const graph = deserializeTeamGraph(serializedGraph, keyring)
  return teamMachine(graph)
}
