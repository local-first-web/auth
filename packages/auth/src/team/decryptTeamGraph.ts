import { Hash } from '@/util'
import { decryptLink, EncryptedGraph, KeysetWithSecrets, LinkMap } from 'crdx'
import { initialState, TEAM_SCOPE } from './constants'
import { reducer } from './reducer'
import { keys } from './selectors'
import { TeamAction, TeamContext, TeamGraph, TeamLink, TeamState } from './types'

/**
 * Decrypts a graph.
 *
 * This is a team-specific version of `decryptGraph` from crdx. We can't just use a single set of
 * team keys to decrypt everything, because sometimes keys are rotated. When that happens, each team
 * member gets the new keys in a lockbox that's stored on the chain. So we need to recurse through
 * the chain, updating the keys if necessary before continuing to decrypt further.
 */
export const decryptTeamGraph = ({
  encryptedGraph,
  childMap,
  teamKeys,
  deviceKeys,
}: {
  encryptedGraph: EncryptedGraph

  /**
   * We need to know the parent/child structure of the graph in order to decrypt it properly,
   * because we need to reduce as we go in order to get updated team keys.
   */
  childMap: LinkMap

  /**
   * We need the first-generation team keys to get started. If the team keys have been rotated, we
   * will find them in lockboxes that we can get to with our device keys.
   */
  teamKeys: KeysetWithSecrets

  /**
   * We need our device keys so that we can get the latest team keys from the graph if they've been
   * rotated.
   */
  deviceKeys: KeysetWithSecrets
}): TeamGraph => {
  const { encryptedLinks, links = {}, root } = encryptedGraph as TeamGraph

  /** Recursively decrypts a link and its children. */
  const decrypt = (
    hash: Hash,
    prevKeys: KeysetWithSecrets,
    prevDecryptedLinks: Record<Hash, TeamLink> = {},
    prevState: TeamState = initialState,
  ): Record<Hash, TeamLink> => {
    // decrypt this link
    const encryptedLink = encryptedLinks[hash]!
    const decryptedLink =
      links[hash] ?? // if it's already decrypted, don't bother decrypting it again
      decryptLink<TeamAction, TeamContext>(encryptedLink, prevKeys)
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
