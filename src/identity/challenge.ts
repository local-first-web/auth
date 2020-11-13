import { Challenge } from './types'
import { KeyScope, randomKey } from '/keyset'

export const challenge = (identityClaim: KeyScope): Challenge => ({
  ...identityClaim,
  nonce: randomKey(),
  timestamp: new Date().getTime(),
})
