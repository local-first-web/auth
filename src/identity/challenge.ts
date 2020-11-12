import { KeyScope, randomKey } from '/keyset'
import { ChallengeIdentityMessage } from '/message'

// TODO: refactor so this just generates the payload

export const challenge = (identityClaim: KeyScope): ChallengeIdentityMessage => ({
  type: 'CHALLENGE_IDENTITY',
  payload: {
    ...identityClaim,
    nonce: randomKey(),
    timestamp: new Date().getTime(),
  },
})
