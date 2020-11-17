import { getCommonPredecessor } from './getPredecessors'
import { getHead } from './getHead'
import { getRoot } from '/chain/getRoot'
import {
  ChainLink,
  isMergeLink,
  LinkBody,
  RootLink,
  SignatureChain,
  SignedLink,
} from '/chain/types'

/**
 * Takes a `SignatureChain` and returns an array of links by performing a topographical sort and
 * filter. For example, this chain
 *```
 *           ┌─→ c ─→ d ─┐
 * a ─→ b ─→ ┴─→ e ───── * ─→ f
 *```

 * might be transformed to this sequence
 *```
 * [a, b, e, c, d, f]
 *```
 * The logic for merging these branches is encapsulated in a `Resolver` function provided in the
 * options. In the example above, the two concurrent branches `[c,d]` and `[e]` are merged into `[e,
 * c, d]`. A different resolver might return the links in a different order, and/or omit some
 * links.
 *
 * @param chain The SignatureChain containing the links to be sequenced
 * @param options.resolver A function that takes two sequences and returns a single sequence
 * combining the two while applying any necessary business logic regarding which links take
 * precedence, which are omitted, etc.
 * @param options.root The link to use as the chain's root (used to process a subchain)
 * @param options.head The link to use as the chain's head (used to process a subchain)
 */
export const getSequence = <T extends LinkBody>(
  chain: SignatureChain<T>,
  options: GetSequenceOptions<T> = {}
): (SignedLink<T> | RootLink)[] => {
  const {
    resolver = trivialResolver, //
    root = getRoot(chain),
    head = getHead(chain),
  } = options

  // recursive inner function - returns the given link's predecessors and the given link
  const visit = (link: ChainLink<T>): (SignedLink<T> | RootLink)[] => {
    if (link === root) {
      // root - we're done
      return []
    } else if (!isMergeLink(link)) {
      // just one parent - keep going
      const parent = chain.links[link.body.prev!]!
      return visit(parent).concat(isMergeLink(parent) ? [] : [parent])
    } else {
      // merge link - need to resolve the two branches it merges, going back to the first common predecessor
      const [a, b] = link.body.map(hash => chain.links[hash]!) // these are the two heads being merged
      const predecessor = getCommonPredecessor(chain, a, b)
      const branchA = getSequence(chain, { root: predecessor, head: a, resolver }).slice(1) // omit the common predecessor
      const branchB = getSequence(chain, { root: predecessor, head: b, resolver }).slice(1)
      const mergedBranches = resolver(branchA, branchB)
      return visit(predecessor).concat(onlyIfNotMergeLink(predecessor)).concat(mergedBranches)
    }
  }

  // we start from the head and work our way back, because it's simpler than doing it in the
  // opposite direction (a merge link has exactly two parents, but any given link can have any
  // number of children)
  return visit(head).concat(onlyIfNotMergeLink(head))
}

/// If no resolver is provided, we just concatenate the two sequences
const trivialResolver: Resolver = (a, b) => {
  const [_a, _b] = [a, b].sort() // ensure deterministic order
  return _a.concat(_b)
}

const onlyIfNotMergeLink = (link: ChainLink<any>) => (isMergeLink(link) ? [] : [link])

/// A resolver takes two sequences, and returns a single sequence combining the two
/// while applying any necessary business logic regarding which links take precedence, which
/// will be discarded, etc.
export type Resolver = <T extends LinkBody>(
  a: (SignedLink<T> | RootLink)[],
  b: (SignedLink<T> | RootLink)[]
) => (SignedLink<T> | RootLink)[]

export type GetSequenceOptions<T extends LinkBody> = {
  resolver?: Resolver
  root?: ChainLink<T>
  head?: ChainLink<T>
}
