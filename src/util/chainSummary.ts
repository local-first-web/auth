import { TeamSignatureChain, getSequence, membershipResolver, TeamAction } from '/chain'
import { actionFingerprint } from '/chain/actionFingerprint'

export const chainSummary = (chain: TeamSignatureChain) =>
  getSequence<TeamAction>({ chain, resolver: membershipResolver })
    .map(l => actionFingerprint(l))
    .join(', ')
