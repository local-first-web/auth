import {
  decryptGraph,
  getChildMap,
  type EncryptedGraph,
  type Keyring,
  type LinkMap,
} from '@localfirst/crdx'
import { type TeamGraph } from './types.js'

export const EMPTY: LinkMap = {}

export const serializeTeamGraph = (graph: TeamGraph): string => {
  const childMap = getChildMap(graph)

  // Leave out the unencrypted `links` element
  const { encryptedLinks, head, root } = graph
  const encryptedGraph = { encryptedLinks, childMap, head, root }

  const serialized = JSON.stringify(encryptedGraph)
  return serialized
}

export const deserializeTeamGraph = (serialized: string, keys: Keyring): TeamGraph => {
  const encryptedGraph = JSON.parse(serialized) as EncryptedGraph
  return decryptGraph({ encryptedGraph, keys })
}

export const maybeDeserialize = (source: string | TeamGraph, teamKeyring: Keyring): TeamGraph =>
  isGraph(source) ? source : deserializeTeamGraph(source, teamKeyring)

const isGraph = (source: string | TeamGraph): source is TeamGraph => source?.hasOwnProperty('root')
