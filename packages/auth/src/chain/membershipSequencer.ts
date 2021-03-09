import { actionFingerprint } from './actionFingerprint'
import { arbitraryDeterministicSort } from '@/chain/arbitraryDeterministicSort'
import { Sequence, Sequencer, TeamAction, TeamActionLink } from '@/chain/types'

/**
 * This is just like the arbitraryDeterministicSequencer except that it eliminates duplicate
 * membership actions. If A and B do the same thing (e.g. concurrently add the same member), we only
 * keep the first action we come across.
 */
export const membershipSequencer: Sequencer<TeamAction> = (
  a: Sequence<TeamAction>,
  b: Sequence<TeamAction>
) => {
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort()) // ensure predictable order
  const sequence = _a.concat(_b)
  // only keep the first copy we see of any duplicate actions
  const duplicates = getDuplicates(sequence)
  return sequence.filter(linkNotIn(duplicates))
}

// TODO: an add->remove->add sequence on one side will result in add->remove, because the two adds
// are treated as duplicates

const getDuplicates = (b: Sequence<TeamAction>): Sequence<TeamAction> => {
  const seen = {} as Record<string, boolean>
  const duplicates = b.filter(link => {
    const fingerprint = actionFingerprint(link) // string summarizing the link, e.g. `ADD:bob`
    if (seen[fingerprint]) {
      return true
    } else {
      seen[fingerprint] = true
      return false
    }
  })
  return duplicates
}

const linkNotIn = (excludeList: TeamActionLink[]) => (link: TeamActionLink): boolean =>
  !excludeList.includes(link)
