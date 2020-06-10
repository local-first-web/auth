import { KeyScope } from '/keyset'
import { ClaimIdentityMessage } from '/message'

export const claim = (scope: KeyScope): ClaimIdentityMessage => ({
  type: 'CLAIM_IDENTITY',
  payload: scope,
})
