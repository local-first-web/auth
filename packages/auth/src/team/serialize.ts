export const EMPTY: LinkMap = {}
import {
  decryptLink,
  EncryptedGraph,
  getChildMap,
  Hash,
  KeysetWithSecrets,
  LinkMap,
} from '@localfirst/crdx'
import { initialState, TEAM_SCOPE } from './constants'
import { reducer } from './reducer'
import { keys } from './selectors'
import { TeamAction, TeamContext, TeamGraph, TeamLink, TeamState } from './types'

export const serializeTeamGraph = (graph: TeamGraph): string => {
  // only persist the encrypted links
  const { links, ...encryptedGraph } = graph

  // to decrypt the graph, we'll need to know its dependency structure
  const childMap = getChildMap(graph)

  const serialized = JSON.stringify({ childMap, encryptedGraph })
  return serialized
}

export const deserializeTeamGraph = (
  serialized: string,
  teamKeys: KeysetWithSecrets,
  deviceKeys: KeysetWithSecrets
): TeamGraph => {
  const deserialized = JSON.parse(serialized)
  const { encryptedGraph, childMap } = deserialized as {
    encryptedGraph: EncryptedGraph
    childMap: LinkMap
  }
  return decryptTeamGraph({ encryptedGraph, childMap, teamKeys, deviceKeys })
}

/**
 * Decrypts a graph.
 *
 * This is a team-specific version of `decryptGraph` from crdx. We can't just use a single set of
 * team keys to decrypt everything, because sometimes keys are rotated. When that happens, each team
 * member gets the new keys in a lockbox that's stored on the chain. So we need to recurse through
 * the chain, updating the keys if necessary before continuing to decrypt further.
 * */
export const decryptTeamGraph = ({
  encryptedGraph,
  teamKeys,
  childMap,
  deviceKeys,
}: {
  encryptedGraph: EncryptedGraph
  childMap: LinkMap
  teamKeys: KeysetWithSecrets
  deviceKeys: KeysetWithSecrets
}): TeamGraph => {
  const { encryptedLinks, root } = encryptedGraph as TeamGraph

  /** Recursively decrypts a link and its children. */
  const decrypt = (
    hash: Hash,
    prevKeys: KeysetWithSecrets,
    prevDecryptedLinks: Record<Hash, TeamLink> = {},
    prevState: TeamState = initialState
  ): Record<Hash, TeamLink> => {
    // decrypt this link
    const encryptedLink = encryptedLinks[hash]!
    const decryptedLink = decryptLink<TeamAction, TeamContext>(encryptedLink, prevKeys) as TeamLink
    var decryptedLinks = {
      [hash]: decryptedLink,
    }

    // reduce & see if there are new team keys
    const newState = reducer(prevState, decryptedLink)
    var newKeys: KeysetWithSecrets | undefined
    try {
      newKeys = keys(newState, deviceKeys, TEAM_SCOPE)
    } catch (error) {
      newKeys = prevKeys
    }

    // decrypt its children
    const children = childMap[hash]

    if (children) {
      children.forEach(hash => {
        decryptedLinks = { ...decryptedLinks, ...decrypt(hash, newKeys, decryptedLinks, newState) }
      })
    }

    return { ...prevDecryptedLinks, ...decryptedLinks }
  }

  const decryptedLinks = decrypt(root, teamKeys)

  return {
    ...encryptedGraph,
    links: decryptedLinks,
  }
}
