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

// Each memoized function gets its own cache, so these two can't collide even though their
// resolvers see the same argument. The seeds are distinct anyway: the keys are what a future
// shared cache would collide on, and they cost nothing now.
export const validate = memoize(_validate, graph => hash('memoize', graph))
export const validateStructure = memoize(_validateStructure, graph =>
  hash('memoizeStructure', graph)
)
