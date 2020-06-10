import { KeyScope } from '/keyset'
import { Base64 } from '/lib'

export type Message = ClaimIdentityMessage | ChallengeIdentityMessage | ProveIdentityMessage

export type ClaimIdentityMessage = {
  type: 'CLAIM_IDENTITY'
  payload: KeyScope
}

export type ChallengeIdentityMessage = {
  type: 'CHALLENGE_IDENTITY'
  payload: ChallengePayload
}

export type ProveIdentityMessage = {
  type: 'PROVE_IDENTITY'
  payload: ChallengePayload & {
    signature: Base64
  }
}

type ChallengePayload = KeyScope & {
  nonce: Base64
  timestamp: UnixTimestamp
}

export type UnixTimestamp = number
