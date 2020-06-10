import { signatures } from '/crypto'
import { KeysetWithSecrets } from '/keyset'
import { ChallengeIdentityMessage, ProveIdentityMessage } from '/message'

export const prove = (
  { payload }: ChallengeIdentityMessage,
  keys: KeysetWithSecrets
): ProveIdentityMessage => ({
  type: 'PROVE_IDENTITY',
  payload: {
    ...payload,
    signature: signatures.sign(payload, keys.signature.secretKey),
  },
})
