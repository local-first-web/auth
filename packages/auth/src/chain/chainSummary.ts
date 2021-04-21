import { actionFingerprint } from '@/chain/actionFingerprint'
import { getSequence } from '@/chain/getSequence'
import { TeamAction, TeamSignatureChain } from '@/chain/types'
import { membershipResolver as resolver } from '@/chain/membershipResolver'
import { membershipSequencer as sequencer } from '@/chain/membershipSequencer'

export const chainSummary = (chain: TeamSignatureChain) => {
  const links = getSequence<TeamAction>({ chain, sequencer, resolver })
    .map(l => actionFingerprint(l))
    .join(', ')
  return links //`${chain.head.slice(0, 5)}:${links}`
}
