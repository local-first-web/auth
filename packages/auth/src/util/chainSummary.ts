import { actionFingerprint } from './actionFingerprint'
import { getSequence } from 'crdx'
import { TeamAction, TeamSignatureChain } from '@/team/types'
import { membershipResolver as resolver } from '@/team/membershipResolver'
import { membershipSequencer as sequencer } from '@/team/membershipSequencer'

export const chainSummary = (chain: TeamSignatureChain) => {
  const links = getSequence<TeamAction>({ chain, sequencer, resolver })
    .map(l => actionFingerprint(l))
    .join(', ')
  return links //`${chain.head.slice(0, 5)}:${links}`
}
