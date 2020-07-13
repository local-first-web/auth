import { KeyScope } from '/keyset'
import { Base64 } from '/util'

export type ClaimIdentityMessage = {
  type: 'CLAIM_IDENTITY'
  payload: KeyScope
}

export type ChallengeIdentityMessage = {
  type: 'CHALLENGE_IDENTITY'
  payload: Challenge
}

type Challenge = KeyScope & {
  nonce: Base64
  timestamp: UnixTimestamp
}

export type ProveIdentityMessage = {
  type: 'PROVE_IDENTITY'
  payload: {
    challenge: Challenge
    signature: Base64
  }
}

export type AcceptIdentityMessage = {
  type: 'ACCEPT_IDENTITY'
  payload: {
    nonce: Base64
  }
}

export type RejectIdentityMessage = {
  type: 'REJECT_IDENTITY'
  payload: {
    message: string
  }
}

export type UnixTimestamp = number
