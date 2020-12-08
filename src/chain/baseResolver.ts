import { getSequence } from '/chain/getSequence'
import { getCommonPredecessor } from '/chain/predecessors'
import { Resolver } from '/chain/types'

// This resolver just collapses each branch to a single sequence of actions
export const baseResolver: Resolver = ([a, b], chain) => {
  const root = getCommonPredecessor(chain, [a, b])
  const [branchA, branchB] = [a, b]
    .map(head => getSequence({ chain, root, head })) // get the branch corresponding to each head
    .map(branch => branch.slice(1)) // omit the common predecessor itself
  return [branchA, branchB]
}
