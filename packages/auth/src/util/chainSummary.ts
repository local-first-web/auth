import { actionFingerprint } from './actionFingerprint'
import { getSequence } from 'crdx'
import { TeamAction, TeamContext, TeamSignatureChain } from '@/team/types'
import { membershipResolver as resolver } from '@/team/membershipResolver'

export const chainSummary = (chain: TeamSignatureChain) => {
  const links = getSequence<TeamAction, TeamContext>(chain, resolver)
    .map(l => actionFingerprint(l))
    .join(', ')
  return links //`${chain.head.slice(0, 5)}:${links}`
}
