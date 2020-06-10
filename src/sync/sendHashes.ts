import { SignatureChain } from '/chain'
import { SendHashesMessage } from '/message'

export const sendHashes = (chain: SignatureChain): SendHashesMessage => {
  return {
    type: 'SEND_HASHES',
    payload: {
      // TODO: only send last few hashes, send more if needed
      hashes: chain.map(link => link.hash),
      chainLength: chain.length,
    },
  }
}
