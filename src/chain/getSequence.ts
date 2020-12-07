import { getHead } from '/chain/getHead'
import { getCommonPredecessor, isPredecessor } from '/chain/predecessors'
import { trivialResolver } from '/chain/trivialResolver'
import { getRoot } from '/chain/getRoot'
import {
  Action,
  ActionLink,
  isMergeLink,
  isRootLink,
  Link,
  Resolver,
  SignatureChain,
} from '/chain/types'
import { assert } from '/util'

/**
 * Takes a `SignatureChain` and returns an array of links by performing a topographical sort and
 * filter. For example, this chain
 * ```
 *            ┌─→ c ─→ d ─┐
 *  a ─→ b ─→ ┴─→ e ───── * ─→ f
 * ```
 *  might be transformed to this sequence
 * ```
 *  [a, b, e, c, d, f]
 * ```
 *
 * The logic for merging these branches is encapsulated in a `Resolver` function provided in the
 * options. In the example above, the two concurrent branches `[c, d]` and `[e]` are resolved as
 * `[e, c, d]`. A different resolver might return the links in a different order, and/or omit some
 * links; so these concurrent branches might also be resolved as:
 * ```
 * [c, d, e]
 * [c, e, d]
 * [c, d]
 * [e, d]
 * [e]
 * ... etc.
 * ```
 *
 * If no resolver is provided, a trivial default one will be used. The default resolver simply
 * concatenates the concurrent branches in an arbitrary but deterministic order.
 *
 * You can also get the sequence of a fragment of a chain, by passing a `root` and/or a `head`; this
 * will resolve the subchain starting at `root` and ending at `head`.
 *
 * @param chain The SignatureChain containing the links to be sequenced
 * @param options.resolver A function that takes two sequences and returns a single sequence
 * combining the two while applying any necessary business logic regarding which links take
 * precedence, which are omitted, etc.
 * @param options.root The link to use as the chain's root (used to process a subchain)
 * @param options.head The link to use as the chain's head (used to process a subchain)
 */
export const getSequence = <A extends Action>(options: {
  chain: SignatureChain<A>
  root?: Link<A>
  head?: Link<A>
  resolver?: Resolver<A>
}): ActionLink<A>[] => {
  const {
    chain,
    root = getRoot(chain),
    head = getHead(chain),
    resolver = trivialResolver,
  } = options

  // omit merge links from result
  const onlyActionLinks = <A extends Action>(seq: Link<A>[]) =>
    seq.filter(n => !isMergeLink(n)) as ActionLink<A>[]

  // 0 parents (root link)
  if (head === root) {
    // just return that one node
    return onlyActionLinks([head])
  }

  // 1 parent (normal action link)
  else if (!isMergeLink(head)) {
    assert(!isRootLink(head))

    // work our way backwards
    const parent = chain.links[head.body.prev]
    const predecessors = getSequence({ chain, resolver, root, head: parent })
    return onlyActionLinks([...predecessors, head])
  }

  // 2 parents (merge link)
  else {
    // need to resolve the two branches it merges, going back to the first common predecessor,
    // then continue from there

    // the two links merged by the merge link
    const branchHeads = head.body.map(hash => chain.links[hash]!)

    // their most recent common predecessor
    const commonPredecessor = getCommonPredecessor(chain, branchHeads)

    if (isPredecessor(chain, commonPredecessor, root)) {
      /** If common predecessor *precedes* the *root* we've been given, the root lives *on* one of
       *  these two branches. In this case we're only interested in the branch that the root is on; we
       *  can ignore the other one.
       *  ```
       *    a ─→ b(COMMON) ─┬─→ c ─→ d ─→ e ──────── * ──→ j(HEAD)
       *                    └─→ f → g(ROOT) → h → i ─┘
       *  ```
       *  For example, in the above scenario we're resolving the branches that end in `e` and `i`,
       *  respectively. But we see that common predecessor comes before the root, which tells us that
       *  the root is on one of those two branches, and we're only interested in the one with the root
       *  on it, starting with the root: in this case the branch `g → h → i`. And we don't need to resolve
       *  that against `c → d → e`.
       */
      const isOurBranchHead = (h: Link<A>) => root === h || isPredecessor(chain, root, h)
      const ourBranchHead = branchHeads.find(isOurBranchHead)!
      return getSequence({ chain, root, head: ourBranchHead, resolver })
    }

    // we need to merge the two branches, going back to the most recent common predecessor
    else {
      const getBranchSequence = (branchHead: Link<A>): ActionLink<A>[] => {
        // each branch is the sequence from the common predecessor to the branch head
        const branch = getSequence({ chain, root: commonPredecessor, head: branchHead, resolver })

        // omit the common predecessor itself from the branch
        return branch.filter(n => n !== commonPredecessor)
      }

      // the common predecessor is after the root, so we have two branches that we'll need to merge
      // let's first make sure each one is a sequence
      const [branchA, branchB] = branchHeads.map(getBranchSequence)

      // apply the resolver to these two sequences to come up with a single sequence
      const resolvedBranches = resolver(branchA, branchB, chain)

      // now we can resume working our way back from the common predecessor towards the root
      const predecessors = getSequence({ chain, resolver, root, head: commonPredecessor })

      return onlyActionLinks([...predecessors, ...resolvedBranches, head])
    }
  }
}
