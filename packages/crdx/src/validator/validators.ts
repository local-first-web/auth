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

  /**
   * A link can't be older than a link it descends from.
   *
   * This is a statement about the graph and nothing else: both timestamps are bytes already on it,
   * every peer reads the same pair, and no clock anywhere takes part. It belongs here rather than
   * with the clock rules it used to share a function with, by the same test as everything else in
   * this set — nothing about the passage of time can turn a pass into a failure or back.
   *
   * It's also the only thing standing between a backdated link and the peers who replay it.
   * Anything the application judges against `link.body.timestamp` — `@localfirst/auth` judges
   * invitation expiry that way — is judging a number the link's author chose, and an author who
   * sets their clock back can choose one that has already gone by. What they can't do is make the
   * links they're building on any younger, so a backdated link is refused by every peer as long as
   * the graph it's appended to carries anything later.
   */
  validateTimestampOrder(link, graph) {
    const { timestamp } = link.body
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
 * 'Advisory' describes what `makeMachine` does with a failure, and nothing more. `Store.validate`
 * reports these alongside the structural rules, which is where an application is meant to ask. The
 * sync protocol does NOT treat them as advice: `receiveMessage` runs the full set over the merged
 * graph and, on any failure, discards the merge outright, increments `failedSyncCount` and sends
 * the error back to the peer. So a peer whose clock runs fast is still refused over the wire, and
 * a reader shouldn't conclude from this comment that clock skew is harmless everywhere — only that
 * it no longer makes a stored graph unopenable. Bringing the wire path in line is tracked
 * separately.
 */
export const advisoryValidators: ValidatorSet = {
  /** A link's timestamp can't be in the future, relative to the current time on this device. */
  validateTimestampNotInFuture(link, _graph) {
    const { timestamp } = link.body
    const now = Date.now()
    if (timestamp > now) {
      return fail(`The link's timestamp is in the future.`, { link, now })
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
