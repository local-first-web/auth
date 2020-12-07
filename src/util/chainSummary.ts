import { TeamSignatureChain, getSequence } from '/chain'
import { actionFingerprint } from '/chain/actionFingerprint'

export const chainSummary = (chain: TeamSignatureChain) =>
  getSequence({ chain })
    .map(l => actionFingerprint(l))
    .join(', ')
