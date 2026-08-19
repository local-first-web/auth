import { ROOT, VALID } from 'constants.js'
import { getRoot } from 'graph/getRoot.js'
import { hashEncryptedLink } from 'graph/hashLink.js'
import { ValidationError, type ValidatorSet } from './types.js'

/**
 * Rules about the shape of the graph itself: that a link is the bytes it claims to be, that the
 * links it names exist, and that the ROOT link is the graph's root and nothing else is.
 *
 * A graph that breaks one of these isn't a graph anyone can replay — every answer read out of it
 * afterwards is meaningless — so `makeMachine` refuses one outright rather than folding it. They
 * are decidable from the graph alone: two peers holding the same bytes always agree about them,
 * and no passage of time or change of environment can turn a pass into a failure or back.
 */
export const structuralValidators: ValidatorSet = {
  /** Does this link's hash check out? */
  validateHash(link, graph) {
    const { hash } = link
    const { encryptedBody } = graph.encryptedLinks[hash]
    const computedHash = hashEncryptedLink(encryptedBody)
    if (hash === computedHash) return VALID
    return fail(`The hash calculated for this link does not match.`, {
      link,
      hash,
      expected: computedHash,
    })
  },

  /** Do the previous link(s) referenced by this link exist?  */
  validatePrev(link, graph) {
    for (const hash of link.body.prev)
      if (!(hash in graph.links))
        return fail(
          `The link referenced by one of the hashes in the \`prev\` property does not exist.`
        )

    return VALID
  },

  /** If this is a root link, it should not have any predecessors, and should be the graph's root */
  validateRoot(link, graph) {
    const hasNoPrevLink = link.body.prev.length === 0
    const hasRootType = 'type' in link.body && link.body.type === ROOT
    const isTheGraphRoot = getRoot(graph) === link
    // all should be true, or all should be false
    if (hasNoPrevLink === isTheGraphRoot && isTheGraphRoot === hasRootType) return VALID

    const message = hasRootType
      ? // ROOT
        hasNoPrevLink
        ? `The ROOT link has to be the link referenced by the graph \`root\` property` // ROOT but isn't graph root
        : `The ROOT link cannot have any predecessors` // ROOT but has prev link
      : // not ROOT
        hasNoPrevLink
        ? `Non-ROOT links must have predecessors` // not ROOT but has no prev link
        : 'The link referenced by the graph `root` property must be a ROOT link' // not ROOT but is the graph root
    return fail(message, { link, graph })
  },
}

/**
 * Rules that compare the graph against this device's wall clock.
 *
 * These are advisory, and deliberately not part of what `makeMachine` refuses a graph for. A
 * timestamp reads as being in the future whenever our own clock is behind the one that wrote it,
 * and clock disagreement is ordinary: an NTP step, a resume from sleep, or simply a peer running a
 * few minutes fast. Nothing about that means the graph is untrustworthy, and refusing to replay it
 * would make the document unopenable — not until the graph changed, which it can't, but until wall
 * clock caught up with it.
 *
 * So a failure here is something to report, not something to act on: `Store.validate` runs these
 * along with the structural rules, and the sync protocol counts them toward `failedSyncCount` and
 * lets the application decide how much to trust the peer.
 */
export const advisoryValidators: ValidatorSet = {
  /** Sanity check on timestamps: They can't be in the future, relative to the current time on this
   * device. And they can't be earlier than any links they depend on. */
  validateTimestamps(link, graph) {
    const { timestamp } = link.body

    // timestamp can't be in the future
    const now = Date.now()
    if (timestamp > now) {
      return fail(`The link's timestamp is in the future.`, { link, now })
    }

    // timestamp can't be earlier than any previous link's timestamp
    for (const hash of link.body.prev) {
      const prevLink = graph.links[hash]
      if (prevLink.body.timestamp > timestamp)
        return fail(`This link's timestamp can't be earlier than a previous link.`, {
          link,
          prevLink,
        })
    }

    return VALID
  },
}

/** Every rule there is. This is what `Store.validate` and the sync protocol check against. */
export const validators: ValidatorSet = { ...structuralValidators, ...advisoryValidators }

export const fail = (msg: string, args?: any) => {
  return {
    isValid: false,
    error: new ValidationError(msg, args),
  }
}
