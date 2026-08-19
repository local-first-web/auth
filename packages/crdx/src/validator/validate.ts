import { memoize } from '@localfirst/shared'
import { type ValidationResult, type ValidatorSet } from './types.js'
import { fail, missingEncryptedLink, structuralValidators, validators } from './validators.js'
import { VALID } from '../constants.js'
import { hashEncryptedLink } from '../graph/hashLink.js'
import { type Action, type Link, type Graph } from '../graph/types.js'
import { hash } from '@localfirst/crypto'

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
 */
const _validateStructure = <A extends Action, C>(graph: Graph<A, C>): ValidationResult =>
  runValidators(graph, structuralValidators)

export const validate = _validate

/**
 * How many graph versions `validateStructure` keeps answers for.
 *
 * A replay asks about the graph in front of it, so the entries that earn their keep are the most
 * recent few — the current graph, and any a still-running caller is holding. Ten is enough to lose
 * nothing: counting every call across the auth and crdx suites, this cache and the unbounded one it
 * replaced both take 32 hits out of 95 calls, while the number of entries held goes from 24 to 10.
 */
const MEMOIZED_GRAPH_VERSIONS = 10

/**
 * A `Map` that drops its least recently used entry once it's full — enough of lodash's cache
 * interface for `memoize` to use in place of its default.
 *
 * `Map` iterates in insertion order, so re-inserting on read is what makes the first key out the
 * least recently used one rather than the oldest.
 */
class LruCache<K, V> {
  readonly #entries = new Map<K, V>()

  constructor(private readonly maxSize: number) {}

  get size() {
    return this.#entries.size
  }

  has(key: K) {
    return this.#entries.has(key)
  }

  get(key: K) {
    if (!this.#entries.has(key)) return undefined
    // re-insert to mark this the most recently used
    const value = this.#entries.get(key)!
    this.#entries.delete(key)
    this.#entries.set(key, value)
    return value
  }

  set(key: K, value: V) {
    this.#entries.delete(key)
    this.#entries.set(key, value)
    if (this.#entries.size > this.maxSize) {
      const leastRecentlyUsed = this.#entries.keys().next().value as K
      this.#entries.delete(leastRecentlyUsed)
    }

    return this
  }

  delete(key: K) {
    return this.#entries.delete(key)
  }

  clear() {
    this.#entries.clear()
  }
}

/**
 * The structural rules read nothing but the graph, and this runs on every replay, so this one is
 * worth caching. The seed keeps its keys clear of any other cache built on the same resolver.
 *
 * The key stays a content hash of the whole graph, and that isn't a detail that can be traded for a
 * cheaper one. `validateHash` exists to catch link bytes replaced in place, which leaves both
 * `graph.head` and the graph object's identity untouched — so a cache keyed on either would go on
 * answering 'valid' for a graph this function has to call invalid. The content hash is the only key
 * here that sees what the function sees.
 *
 * It's a real cost: medians of 50 samples on a 201-link chain, 0.42ms to compute the key against
 * 0.77ms to run the three rules (0.84ms against 1.02ms with 1 KB payloads). So a hit saves rather
 * less than half of what it spends getting there, and a miss pays for the key on top of the work.
 * It stays because it does hit — a third of calls across the auth and crdx suites — and because
 * the alternative to this key isn't a cheaper one, it's no cache at all.
 *
 * What it doesn't get to do is grow forever. Every dispatch and every merge makes a new graph
 * object, so lodash's default cache — a `Map` nothing evicts — gained an entry per graph version
 * for the life of the process: 200 appends, 200 entries, measured. An LRU bounds that at
 * `MEMOIZED_GRAPH_VERSIONS` and, measured the same way, takes exactly the same number of hits.
 */
export const validateStructure = memoize(_validateStructure, graph =>
  hash('memoizeStructure', graph)
)

// `memoize` hands back a function with a replaceable `cache`; `nomemoize` (the BYPASS path in
// `@localfirst/shared`) hands back the bare function, which has none and needs none.
if ('cache' in validateStructure) {
  ;(validateStructure as { cache: unknown }).cache = new LruCache<string, ValidationResult>(
    MEMOIZED_GRAPH_VERSIONS
  )
}
