import { type Base58, type Hash, type UnixTimestamp } from '@localfirst/crdx'
import { registeredEncryptionKeys } from './registeredEncryptionKeys.js'
import { type TeamGraph, type TeamState } from './types.js'

/**
 * Finds links whose stated author doesn't match the key that actually encrypted them.
 *
 * Every link records the author's own encryption public key in `senderPublicKey`, and the author
 * can't lie about it — the link only opens with the matching secret. But nothing in validation
 * compares that key against the key the team has registered for `body.userId`, so a member who
 * holds the team keys can author links attributed to anyone else. This walks a chain after the
 * fact and reports every link where those two disagree.
 *
 * This detects forgery; it doesn't prevent it. Note also that the root link establishes the
 * founder's own keys, so a chain forged from the root can vouch for itself and won't be reported.
 */
export const auditAuthorship = (
  /** The team graph to audit, including its encrypted links */
  graph: TeamGraph,
  /** Team state reduced from that graph, used to collect the keys registered for each member */
  state: TeamState
): AuthorshipAnomaly[] => {
  const keysByUserId = registeredEncryptionKeys(state)

  // Inverted, so we can name whoever actually holds the key a forged link was encrypted with
  const userIdByKey = new Map<Base58, string>()
  for (const [userId, keys] of keysByUserId) for (const key of keys) userIdByKey.set(key, userId)

  const anomalies: AuthorshipAnomaly[] = []
  for (const hash of Object.keys(graph.links) as Hash[]) {
    const link = graph.links[hash]
    const encryptedLink = graph.encryptedLinks[hash]

    // We can only check links we hold in encrypted form
    if (!encryptedLink) continue

    const claimedAuthor = link.body.userId
    const { senderPublicKey } = encryptedLink
    if (keysByUserId.get(claimedAuthor)?.has(senderPublicKey)) continue

    anomalies.push({
      hash,
      linkType: link.body.type,
      timestamp: link.body.timestamp,
      claimedAuthor,
      senderPublicKey,
      actualAuthor: userIdByKey.get(senderPublicKey),
    })
  }

  return anomalies
}

export type AuthorshipAnomaly = {
  /** Hash of the offending link */
  hash: Hash

  /** The action type of the link, e.g. `ADD_MEMBER_ROLE` */
  linkType: string

  /** When the link claims to have been authored */
  timestamp: UnixTimestamp

  /** The userId the link is attributed to */
  claimedAuthor: string

  /** The encryption key that actually encrypted the link */
  senderPublicKey: Base58

  /** Whoever holds that key, if it belongs to a known member or server */
  actualAuthor?: string
}
