import { SignatureChain } from '/chain'
import { ProofOfInvitation } from '/invitation'
import { KeyScope } from '/keyset'
import { Member } from '/member'
import { TeamLinkBody } from '/team'
import { Base64 } from '/util'

// Connection control

export type HelloMessage = {
  type: 'HELLO'
  payload: {
    identityClaim: KeyScope // we always claim an identity
    proofOfInvitation?: ProofOfInvitation // we only offer proof of invitation if we're not a member yet
  }
}

export type ErrorMessage = {
  type: 'ERROR'
  payload: {
    message: string
    details?: any
  }
}

export type DisconnectMessage = {
  type: 'DISCONNECT'
  payload: {
    message: string
  }
}

// Invitations

export type AcceptInvitationMessage = {
  type: 'ACCEPT_INVITATION'
  payload: {
    chain: string
  }
}

// Identity

type Challenge = KeyScope & {
  nonce: Base64
  timestamp: UnixTimestamp
}

export type ChallengeIdentityMessage = {
  type: 'CHALLENGE_IDENTITY'
  payload: Challenge
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
    encryptedSeed: Base64
  }
}

export type RejectIdentityMessage = {
  type: 'REJECT_IDENTITY'
  payload: {
    message: string
  }
}

export type UnixTimestamp = number
