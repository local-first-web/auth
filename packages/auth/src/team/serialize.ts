import {
  decryptGraph,
  getChildMap,
  type EncryptedGraph,
  type Keyring,
  type LinkMap,
} from '@localfirst/crdx'
import { type TeamGraph } from './types.js'
import { pack, unpack } from 'msgpackr'

export const EMPTY: LinkMap = {}

export const serializeTeamGraph = (graph: TeamGraph) => {
  const childMap = getChildMap(graph)

  // Leave out the unencrypted `links` element
  const { encryptedLinks, head, root } = graph
  const encryptedGraph = { encryptedLinks, childMap, head, root }

  const serialized = pack(encryptedGraph)
  return toUint8Array(serialized)
}

export const deserializeTeamGraph = (serialized: Uint8Array, keys: Keyring): TeamGraph => {
  const encryptedGraph = unpack(serialized) as EncryptedGraph
  return decryptGraph({ encryptedGraph, keys })
}

export const maybeDeserialize = (
  source: Uint8Array | TeamGraph,
  teamKeyring: Keyring
): TeamGraph => (isGraph(source) ? source : deserializeTeamGraph(source, teamKeyring))

const isGraph = (source: Uint8Array | TeamGraph): source is TeamGraph =>
  source?.hasOwnProperty('root')

// buffer to uint8array
const toUint8Array = (buf: Buffer) => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
