import {
  actionFingerprint,
  getSequence,
  membershipResolver as resolver,
  membershipSequencer as sequencer,
  TeamAction,
  TeamSignatureChain,
} from '/chain'

export const chainSummary = (chain: TeamSignatureChain) =>
  getSequence<TeamAction>({ chain, sequencer, resolver })
    .map((l) => actionFingerprint(l))
    .join(', ')
