import { TeamSignatureChain, getSequence, TeamAction } from '/chain'
import { actionFingerprint } from '/chain/actionFingerprint'
import { membershipResolver as resolver } from '/chain/membershipResolver'
import { membershipSequencer as sequencer } from '/chain/membershipSequencer'

export const chainSummary = (chain: TeamSignatureChain) =>
  getSequence<TeamAction>({ chain, sequencer, resolver })
    .map((l) => actionFingerprint(l))
    .join(', ')
