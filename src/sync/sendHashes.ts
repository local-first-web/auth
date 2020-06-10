import { SignatureChain } from '/chain'
import { SendHashes } from '/message'

export const sendHashes = (chain: SignatureChain): SendHashes => {
  return {
    type: 'SEND_HASHES',
    payload: {
      // hashes: chain.map(link => link.body.prev),
      hashes: [],
      totalLength: 0,
    },
  }
}
