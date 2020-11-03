import { getCommonAncestor } from './getAncestors'
import { getHead } from './getHead'
import { getRoot } from '/chain/getRoot'
import {
  ChainNode,
  isMergeNode,
  NodeBody,
  RootNode,
  SignatureChain,
  SignedNode,
} from '/chain/types'

/**
 * Takes a `SignatureChain` and returns an array of nodes. For example, this chain
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
 * c, d]`. A different reconciler might return the nodes in a different order, and/or omit some
 * nodes.
 *
 * @param chain The SignatureChain containing the nodes to be sequenced
 * @param options.reconciler A function that takes two sequences and returns a single sequence
 * combining the two while applying any necessary business logic regarding which nodes take
 * precedence, which are omitted, etc.
 * @param options.root The node to use as the chain's root (used to process a subchain)
 * @param options.head The node to use as the chain's head (used to process a subchain)
 */
export const getSequence = <T extends NodeBody>(
  chain: SignatureChain<T>,
  options: GetSequenceOptions<T> = {}
): (SignedNode<T> | RootNode)[] => {
  const {
    reconciler = trivialReconciler, //
    root = getRoot(chain),
    head = getHead(chain),
  } = options

  // recursive inner function - returns the given node's ancestors and the given node
  const visit = (node: ChainNode<T>): (SignedNode<T> | RootNode)[] => {
    if (node === root) {
      // root - we're done
      return []
    } else if (!isMergeNode(node)) {
      // just one parent - keep going
      const parent = chain.nodes.get(node.body.prev!)!
      return visit(parent).concat(isMergeNode(parent) ? [] : [parent])
    } else {
      // merge node - need to reconcile the branches it merges, going back to the first common ancestor
      const [a, b] = node.body.map(hash => chain.nodes.get(hash)!) // these are the two heads being merged
      const ancestor = getCommonAncestor(chain, a, b)
      const branchA = getSequence(chain, { root: ancestor, head: a, reconciler }).slice(1) // omit the ancestor itself
      const branchB = getSequence(chain, { root: ancestor, head: b, reconciler }).slice(1)
      const mergedBranches = reconciler(branchA, branchB)
      return visit(ancestor)
        .concat(isMergeNode(ancestor) ? [] : [ancestor])
        .concat(mergedBranches)
    }
  }

  // we start from the head and work our way back, because it's simpler: a merge node has exactly
  // two parents, but any given node can have any number of children
  return visit(head).concat(isMergeNode(head) ? [] : [head])
}

/// If no reconciler is provided, we just concatenate the two sequences
const trivialReconciler: Reconciler = (a, b) => {
  const [_a, _b] = [a, b].sort() // ensure deterministic order
  return _a.concat(_b)
}

/// A reconciler takes two sequences, and returns a single sequence combining the two
/// while applying any necessary business logic regarding which nodes take precedence, which
/// will be discarded, etc.
export type Reconciler = <T extends NodeBody>(
  a: (SignedNode<T> | RootNode)[],
  b: (SignedNode<T> | RootNode)[]
) => (SignedNode<T> | RootNode)[]

export type GetSequenceOptions<T extends NodeBody> = {
  reconciler?: Reconciler
  root?: ChainNode<T>
  head?: ChainNode<T>
}
