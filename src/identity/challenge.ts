import { randomKey } from '/keyset'
import { ClaimIdentityMessage, ChallengeIdentityMessage } from '/message'

export const challenge = ({ payload }: ClaimIdentityMessage): ChallengeIdentityMessage => ({
  type: 'CHALLENGE_IDENTITY',
  payload: {
    ...payload,
    nonce: randomKey(),
    timestamp: new Date().getTime(),
  },
})
