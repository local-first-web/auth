export const EMPTY: LinkMap = {}
import { decryptGraph, EncryptedGraph, getChildMap, Keyring, LinkMap } from '@localfirst/crdx'
import { TeamGraph } from './types'

export const serializeTeamGraph = (graph: TeamGraph): string => {
  const childMap = getChildMap(graph)

  // leave out the unencrypted `links` element
  const { encryptedLinks, head, root } = graph
  const encryptedGraph = { encryptedLinks, childMap, head, root }

  const serialized = JSON.stringify(encryptedGraph)
  return serialized
}

export const deserializeTeamGraph = (serialized: string, keys: Keyring): TeamGraph => {
  const encryptedGraph = JSON.parse(serialized) as EncryptedGraph
  return decryptGraph({ encryptedGraph, keys })
}
