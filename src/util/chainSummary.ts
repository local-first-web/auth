import { TeamSignatureChain, getSequence, membershipResolver } from '/chain'
import { actionFingerprint } from '/chain/actionFingerprint'

export const chainSummary = (chain: TeamSignatureChain) =>
  getSequence({ chain, resolver: membershipResolver })
    .map(l => actionFingerprint(l))
    .join(', ')
