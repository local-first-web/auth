import { arbitraryDeterministicSequencer } from '@/chain/arbitraryDeterministicSequencer'
import { getHead } from '@/chain/getHead'
import { getRoot } from '@/chain/getRoot'
import { getCommonPredecessor, isPredecessor } from '@/chain/predecessors'
import {
  Action,
  ActionLink,
  isMergeLink,
  isRootLink,
  Link,
  Resolver,
  Sequence,
  Sequencer,
  SignatureChain,
} from '@/chain/types'
import { assert } from '@/util'

/**
 * Takes a `SignatureChain` and returns an array of links by recursively performing a topographical
 * sort and filter. For example, this chain
 * ```
 *              ┌─→ c ─→ d ─┐
 *    a ─→ b ─→ ┴─→ e ───── * ─→ f
 * ```
 *  might be transformed to this sequence
 * ```
 *    [a, b, e, c, d, f]
 * ```
 *
 * The logic for merging these branches is encapsulated in a `Resolver` function provided in the
 * options. In the example above, the two concurrent branches `[c, d]` and `[e]` are resolved as
 * `[e, c, d]`. A different resolver might return the links in a different order, and/or omit some
 * links; so these concurrent branches might also be resolved as:
 * ```
 *   [c, d, e]
 *   [c, e, d]
 *   [c, d]
 *   [e, d]
 *   [e]
 * ```
 * ... etc.
 *
 * If no resolver is provided, a default one will be used. The default resolver simply concatenates
 * the concurrent branches in an arbitrary but deterministic order.
 *
 * You can also get the sequence of a fragment of a chain, by passing a `root` and/or a `head`; this
 * will resolve the subchain starting at `root` and ending at `head`.
 *
 * @param chain The SignatureChain containing the links to be sequenced
 * @param options.root The link to use as the chain's root (used to process a subchain)
 * @param options.head The link to use as the chain's head (used to process a subchain)
 * @param options.resolver A function that takes two sequences and returns a single sequence,
 * applying any logic regarding which links are omitted
 * @param options.sequencer A function that takes two sequences and returns a single sequence,
 * applying any logic regarding which links are omitted
 */
export const getSequence = <A extends Action>(options: SequenceOptions<A>): ActionLink<A>[] => {
  const {
    chain,
    root = getRoot(chain),
    head = getHead(chain),
    resolver = baseResolver,
    sequencer = arbitraryDeterministicSequencer,
  } = options
  let result: Link<A>[]

  // 0 parents (root link)
  if (head === root) {
    // just return that one node
    result = [head]
  }

  // 1 parent (normal action link)
  else if (!isMergeLink(head)) {
    assert(!isRootLink(head))

    // recurse our way backwards
    const parent = chain.links[head.body.prev]
    const predecessors = getSequence({
      ...options,
      head: parent,
    })
    result = [...predecessors, head]
  }

  // 2 parents (merge link)
  else {
    // need to resolve the two branches it merges, going back to the first common predecessor,
    // then continue from there

    // the two links merged by the merge link
    let branchHeads = head.body.map(hash => chain.links[hash]!) as [Link<A>, Link<A>]

    // their most recent common predecessor
    const commonPredecessor = getCommonPredecessor(chain, ...branchHeads)

    // The common predecessor *precedes* the *root* we've been given, so the root lives *on* one
    // of these two branches.
    // ```
    //   a ─→ b(COMMON) ─┬─→ c ─→ d ─→ e ──────── * ──→ j(HEAD)
    //                   └─→ f → g(ROOT) → h → i ─┘
    // ```
    if (isPredecessor(chain, commonPredecessor, root)) {
      // In this case we're only interested in the branch that the root is on; we can ignore the
      // other one.

      // For example, in the above scenario we're resolving the branches that end in `e` and `i`,
      // respectively. But we see that common predecessor comes before the root, which tells us that
      // the root is on one of those two branches, and we're only interested in the one with the
      // root on it, starting with the root: in this case the branch `g → h → i`. And we don't need
      // to resolve that against `c → d → e`.

      // Recursively resolve the branch containing the root into a sequence.
      const isOurBranchHead = (h: Link<A>) => root === h || isPredecessor(chain, root, h)
      const ourBranchHead = branchHeads.find(isOurBranchHead)!
      result = getSequence({
        ...options,
        head: ourBranchHead,
      })
    }

    // The common predecessor is after the root, so we have two branches to merge, going back to
    // the most recent common predecessor.
    else {
      // Resolve each branch (conflicting actions can be omitted by the resolver)
      const [branchA, branchB] = resolver(branchHeads, chain)

      // Sequence the two branches relative to each other
      const sequencedBranches = sequencer(branchA, branchB)

      // Now we can resume recursing our way back from the common predecessor towards the root
      const predecessors = getSequence({
        ...options,
        head: commonPredecessor,
      })

      result = [...predecessors, ...sequencedBranches, head] as Sequence<A>
    }
  }

  // omit merge links before returning result
  return result.filter(n => !isMergeLink(n)) as ActionLink<A>[]
}

type SequenceOptions<A extends Action> = {
  chain: SignatureChain<A>
  root?: Link<A>
  head?: Link<A>
  resolver?: Resolver<A>
  sequencer?: Sequencer<any>
}

// This resolver just collapses each branch to a single sequence of actions
export const baseResolver: Resolver = ([a, b], chain) => {
  const root = getCommonPredecessor(chain, a, b)
  const [branchA, branchB] = [a, b]
    .map(head => getSequence({ chain, root, head })) // get the branch corresponding to each head
    .map(branch => branch.slice(1)) // omit the common predecessor itself
  return [branchA, branchB]
}
