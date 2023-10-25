import {
  type Hash,
  createKeyring,
  decryptLink,
  type Keyring,
  type KeysetWithSecrets,
  type MaybePartlyDecryptedGraph,
} from '@localfirst/crdx'
import { initialState, TEAM_SCOPE } from './constants.js'
import { reducer } from './reducer.js'
import { keys } from './selectors/index.js'
import {
  type TeamAction,
  type TeamContext,
  type TeamGraph,
  type TeamLink,
  type TeamState,
} from './types.js'

/**
 * Decrypts a graph.
 *
 * This is a team-specific version of `decryptGraph` from crdx. When we're communicating with a
 * peer, we can't just use a single set of team keys to decrypt everything, because there might be
 * key rotations in links that we receive that we will need to decrypt subsequent links. When that
 * happens, each team member gets the new keys in a lockbox that's stored on the chain. So we need
 * to recurse through the chain, updating the keys if necessary before continuing to decrypt
 * further.
 */
export const decryptTeamGraph = ({
  encryptedGraph,
  teamKeys,
  deviceKeys,
}: {
  encryptedGraph: MaybePartlyDecryptedGraph<TeamAction, TeamContext>

  /**
   * We need the first-generation team keys to get started. If the team keys have been rotated, we
   * will find them in lockboxes that we can get to with our device keys.
   */
  teamKeys: KeysetWithSecrets | KeysetWithSecrets[] | Keyring

  /**
   * We need our device keys so that we can get the latest team keys from the graph if they've been
   * rotated.
   */
  deviceKeys: KeysetWithSecrets
}): TeamGraph => {
  const keyring = createKeyring(teamKeys)

  const { encryptedLinks, childMap, root } = encryptedGraph
  const links = encryptedGraph.links ?? {}

  /** Recursively decrypts a link and its children. */
  const decrypt = (
    hash: Hash,
    previousKeys: KeysetWithSecrets,
    previousDecryptedLinks: Record<Hash, TeamLink> = {},
    previousState: TeamState = initialState
  ): Record<Hash, TeamLink> => {
    // Decrypt this link
    const encryptedLink = encryptedLinks[hash]!
    const decryptedLink =
      links[hash] ?? // If it's already decrypted, don't bother decrypting it again
      decryptLink<TeamAction, TeamContext>(encryptedLink, previousKeys)
    let decryptedLinks = {
      [hash]: decryptedLink,
    }

    // Reduce & see if there are new team keys
    const newState = reducer(previousState, decryptedLink)
    let newKeys: KeysetWithSecrets | undefined
    try {
      newKeys = keys(newState, deviceKeys, TEAM_SCOPE)
      keyring[newKeys.encryption.publicKey] = newKeys
    } catch {
      newKeys = previousKeys
    }

    // Decrypt its children
    const children = childMap[hash]

    if (children) {
      for (const hash of children) {
        decryptedLinks = {
          ...decryptedLinks,
          ...decrypt(hash, newKeys, decryptedLinks, newState),
        }
      }
    }

    return { ...previousDecryptedLinks, ...decryptedLinks }
  }

  const rootPublicKey = encryptedLinks[root]!.recipientPublicKey
  const rootKeys = keyring[rootPublicKey]
  const decryptedLinks = decrypt(root, rootKeys)

  return {
    ...encryptedGraph,
    links: decryptedLinks,
  }
}
