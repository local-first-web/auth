import { getCommonAncestor } from './getAncestors'
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
 * Takes a `SignatureChain` and returns an array of links. For example, this chain
 *```
 *           ┌─→ c ─→ d ─┐
 * a ─→ b ─→ ┴─→ e ───── * ─→ f
 *```
 * might be transformed to this sequence
 *```
 * [a, b, e, c, d, f]
 *```
 * The logic for merging these branches is encapsulated in a `Reconciler` function provided in the
 * options. In the example above, the two concurrent branches `[c,d]` and `[e]` are merged into `[e,
 * c, d]`. A different reconciler might return the links in a different order, and/or omit some
 * links.
 *
 * @param chain The SignatureChain containing the links to be sequenced
 * @param options.reconciler A function that takes two sequences and returns a single sequence
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
    reconciler = trivialReconciler, //
    root = getRoot(chain),
    head = getHead(chain),
  } = options

  // recursive inner function - returns the given link's ancestors and the given link
  const visit = (link: ChainLink<T>): (SignedLink<T> | RootLink)[] => {
    if (link === root) {
      // root - we're done
      return []
    } else if (!isMergeLink(link)) {
      // just one parent - keep going
      const parent = chain.links[link.body.prev!]!
      return visit(parent).concat(isMergeLink(parent) ? [] : [parent])
    } else {
      // merge link - need to reconcile the branches it merges, going back to the first common ancestor
      const [a, b] = link.body.map(hash => chain.links[hash]!) // these are the two heads being merged
      const ancestor = getCommonAncestor(chain, a, b)
      const branchA = getSequence(chain, { root: ancestor, head: a, reconciler }).slice(1) // omit the ancestor itself
      const branchB = getSequence(chain, { root: ancestor, head: b, reconciler }).slice(1)
      const mergedBranches = reconciler(branchA, branchB)
      return visit(ancestor)
        .concat(isMergeLink(ancestor) ? [] : [ancestor])
        .concat(mergedBranches)
    }
  }

  // we start from the head and work our way back, because it's simpler: a merge link has exactly
  // two parents, but any given link can have any number of children
  return visit(head).concat(isMergeLink(head) ? [] : [head])
}

/// If no reconciler is provided, we just concatenate the two sequences
const trivialReconciler: Reconciler = (a, b) => {
  const [_a, _b] = [a, b].sort() // ensure deterministic order
  return _a.concat(_b)
}

/// A reconciler takes two sequences, and returns a single sequence combining the two
/// while applying any necessary business logic regarding which links take precedence, which
/// will be discarded, etc.
export type Reconciler = <T extends LinkBody>(
  a: (SignedLink<T> | RootLink)[],
  b: (SignedLink<T> | RootLink)[]
) => (SignedLink<T> | RootLink)[]

export type GetSequenceOptions<T extends LinkBody> = {
  reconciler?: Reconciler
  root?: ChainLink<T>
  head?: ChainLink<T>
}
