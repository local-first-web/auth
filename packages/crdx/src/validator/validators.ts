import { ROOT, VALID } from '../constants.js'
import { getRoot } from '../graph/getRoot.js'
import { hashEncryptedLink } from '../graph/hashLink.js'
import { ValidationError, type ValidatorSet } from './types.js'
import { type Hash } from '../util/index.js'

/**
 * Rules about the shape of the graph itself: that a link is the bytes it claims to be, that the
 * links it names exist, and that the ROOT link is the graph's root and nothing else is.
 *
 * A graph that breaks one of these isn't a graph anyone can replay — every answer read out of it
 * afterwards is meaningless — so `makeMachine` refuses one outright rather than folding it.
 *
 * Membership takes two things, and a rule needs both.
 *
 * The positive reason is the paragraph above: breaking this rule is what makes a graph
 * unreplayable, so refusing the whole graph is the proportionate response. That alone doesn't
 * qualify a rule — `@localfirst/auth`'s `payloadsMustBeWellFormed` catches links that nothing can
 * reduce, and it stays out of a set like this on purpose, because refusing the one bad link is a
 * better answer than bricking everything stored alongside it.
 *
 * The gate is that an honest peer must not be able to produce a graph that fails it. This is where
 * `validateTimestampOrder` was let in and had to be taken back out: it is perfectly decidable from
 * the graph's bytes, which looked like reason enough, but merging a peer whose clock is fast and
 * then appending on a correct one produces an out-of-order link through nobody's fault — and no
 * passage of time repairs it. Being clock-free is not the same as being skew-free.
 *
 * These three pass both. A correct implementation cannot emit a mis-hashed link, a dangling `prev`
 * or a second ROOT, whatever any clock says. (The gate is about what an implementation emits. A
 * graph assembled mid-sync is a different thing: `receiveMessage` merges as soon as any links
 * arrive, so a partial delivery can transiently dangle a `prev`. That path discards the merge and
 * waits for the rest, which is the same answer this set wants and the reason it's what the wire
 * path refuses on.)
 */
export const structuralValidators: ValidatorSet = {
  /** Does this link's hash check out? */
  validateHash(link, graph) {
    const { hash } = link
    const encryptedLink = graph.encryptedLinks[hash]
    if (encryptedLink === undefined) return missingEncryptedLink(hash, 'link')
    const computedHash = hashEncryptedLink(encryptedLink.encryptedBody)
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
 * 'Advisory' now describes what happens to a failure wherever it's checked, not just in one place.
 * `makeMachine` won't refuse a graph for one. `receiveMessage` won't refuse a merge for one either:
 * it takes the merge and counts what it saw under `advisoryFailureCount`, which is deliberately not
 * the `failedSyncCount` an application reads to decide a peer isn't worth talking to, and doesn't
 * send it back to the peer, because nothing was refused. `Store.validate` reports these alongside
 * the structural rules, which is where an application is meant to ask.
 *
 * What that costs is worth naming rather than leaving to be discovered. The wire path used to
 * reject a backdated link, as a side effect of running the whole set: it doesn't any more. That
 * rejection was never worth much — see `validateTimestampOrder`, whose comparison the author can
 * arrange around in one line — and the price of it was refusing honest peers outright. Backdating
 * needs a defence that doesn't rest on a rule the author controls both sides of; that's auth-6bw.
 *
 * The other thing it gave up is a link stamped far in the future. One peer can post a timestamp of
 * the year 10000 and every honest peer now merges it — and from then on `validate`,
 * `Store.validate` and `Team.validate` call that graph invalid for everyone, permanently: no append
 * on a correct clock repairs it and no passage of wall clock catches up with it. Nothing else
 * breaks; authorization, replay, expiry and convergence are all untouched, and a future timestamp
 * only makes an invitation more expired, never less. What it jams is the one channel these rules
 * exist to report on, so an application gating on `validate().isValid` has a permanent denial of
 * service from a single link posted by any member. A ceiling on how far ahead a timestamp may be is
 * the obvious answer, and it's safe here in a way it wasn't for key generations, because wall clock
 * advances to meet it. That's auth-lx7.
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

/**
 * A link's bytes live in its encrypted link, so with that entry missing there's nothing to hash
 * and nothing to compare a hash against. `runValidators` reaches for one in three places — the
 * root check, the head check, and `validateHash` — and all three report a miss this way, so the
 * caller gets the same named failure wherever the hole is. It used to be a `TypeError`: the two
 * bookkeeping checks threw it out of `validate` altogether, and `validateHash` threw a destructuring
 * message that `runOneLink`'s try/catch turned into a failure. See auth-xd2.
 */
export const missingEncryptedLink = (hash: Hash, role: 'root' | 'head' | 'link') =>
  fail(`The graph has no encrypted link for this ${role}`, { hash, role })

export const fail = (msg: string, args?: any) => {
  return {
    isValid: false,
    error: new ValidationError(msg, args),
  }
}
