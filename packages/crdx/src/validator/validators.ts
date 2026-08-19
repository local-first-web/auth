import { ROOT, VALID } from 'constants.js'
import { getRoot } from 'graph/getRoot.js'
import { hashEncryptedLink } from 'graph/hashLink.js'
import { ValidationError, type ValidatorSet } from './types.js'

/**
 * Rules about the shape of the graph itself: that a link is the bytes it claims to be, that the
 * links it names exist, and that the ROOT link is the graph's root and nothing else is.
 *
 * A graph that breaks one of these isn't a graph anyone can replay — every answer read out of it
 * afterwards is meaningless — so `makeMachine` refuses one outright rather than folding it.
 *
 * Being decidable from the graph alone is necessary for membership here and is NOT sufficient, a
 * distinction that cost a round: `validateTimestampOrder` is perfectly decidable from the bytes,
 * and putting it here bricked graphs for honest users. What actually qualifies a rule is that an
 * honest peer cannot produce a graph that fails it. These three hold because a correct
 * implementation cannot emit a mis-hashed link, a dangling `prev`, or a second ROOT — no matter
 * what any clock says, and no matter what a peer it is syncing with did.
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
 * Rules about timestamps.
 *
 * These are advisory, and deliberately not part of what `makeMachine` refuses a graph for. What
 * they have in common isn't that they read a clock — the order rule doesn't — but that clock
 * disagreement between honest peers is enough to make either of them fail. An NTP step, a resume
 * from sleep, or a peer simply running a few minutes fast produces a graph that trips one or the
 * other, and nothing about that means the graph is untrustworthy. Refusing to replay it would make
 * the document unopenable: for a future timestamp until wall clock caught up, and for an
 * out-of-order one forever, since the graph can't change and no clock repairs it.
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
  /**
   * A link shouldn't be older than a link it descends from.
   *
   * Unlike the rule below, this one reads only bytes already on the graph — but that isn't what
   * decides where it belongs, and treating it as though it were is a mistake that has been made
   * here already. An honest peer produces a graph that fails this routinely: `append` stamps
   * `Date.now()` with no clamp against `graph.head`, so if we merge a peer whose clock is ten
   * minutes fast and then do anything at all on our own correct clock, our link is ten minutes
   * older than the link it descends from. Making this fatal meant that ordinary sequence — merge,
   * then append — permanently bricked the graph for every peer, and unlike a future timestamp, no
   * passage of wall clock ever repairs it.
   *
   * It buys no security to make up for that, either. It compares against `link.body.prev`, and the
   * author chooses `prev`: someone spending a backdated link can simply point it at a head from
   * before the activity that would contradict it and re-attach the abandoned branch as a co-head.
   * Confirmed — every peer accepts the result. So this is a consistency signal worth surfacing,
   * not a defence against backdating. What invitation expiry actually needs is to stop trusting an
   * author-supplied clock; that's auth-6bw.
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
