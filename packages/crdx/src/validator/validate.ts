import { memoize } from '@localfirst/shared'
import { type ValidationResult, type ValidatorSet } from './types.js'
import { fail, structuralValidators, validators } from './validators.js'
import { VALID } from 'constants.js'
import { hashEncryptedLink } from 'graph/hashLink.js'
import { type Action, type Link, type Graph } from 'graph/types.js'
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
    const computedHash = hashEncryptedLink(headLink.encryptedBody)
    if (computedHash !== headHash)
      return fail('Head hash does not match the hash of the head link', {
        headHash,
        computedHash,
        headLink,
      })
  }

  // Confirm that there is an encrypted link for each link in the graph and vice versa
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
 * Don't reinstate it with a better key. Any key over a graph means hashing the whole graph, and
 * that costs more than the validators it would save — so a cache here loses money even when it
 * hits. Medians of 50 samples after warmup, on a 201-link team graph: hashing 2.49ms against
 * 1.00ms to run every validator, a ratio of about 2.5. The ratio narrows on smaller links but
 * never turns over (a bare crdx chain of the same length: 0.89 against 0.81 with empty payloads,
 * 1.31 against 1.04 with 1 KB ones).
 *
 * Removing it is a straight win for the sync path on top of that. `receiveMessage` validates a
 * freshly merged graph on every message, so it never hit the cache and paid for the key every
 * time: ~3.5ms per message on that team graph, now ~1.0ms.
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
 * This is what `makeMachine` refuses a graph for, and it's deliberately narrower than `validate`.
 * A graph that fails an advisory rule is still perfectly replayable — clock disagreement between
 * honest peers is enough to trip either of those, whether or not the rule itself reads a clock.
 * See `advisoryValidators`.
 *
 * Application-supplied validators aren't included either. They express what the application means
 * by a well-formed change rather than what the graph structurally is, and the application decides
 * when to ask, via `Store.validate`.
 */
const _validateStructure = <A extends Action, C>(graph: Graph<A, C>): ValidationResult =>
  runValidators(graph, structuralValidators)

export const validate = _validate

// The structural rules read nothing but the graph, and this runs on every replay, so this one is
// worth caching. The seed keeps its keys clear of any other cache built on the same resolver.
// (Its cache is lodash's default: an unbounded Map that gains an entry per graph version and never
// drops one. Pre-existing, small entries, and tracked as auth-bmx rather than fixed here.)
export const validateStructure = memoize(_validateStructure, graph =>
  hash('memoizeStructure', graph)
)
