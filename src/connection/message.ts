import { Connection } from './Connection'
import { Challenge } from '/identity'
import { ProofOfInvitation } from '/invitation'
import { KeyScope } from '/keyset'
import { TeamLink } from '/team'
import { Base64, Hash } from '/util'

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
  payload?: {
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

export type ChallengeIdentityMessage = {
  type: 'CHALLENGE_IDENTITY'
  payload: {
    challenge: Challenge
  }
}

export type ProveIdentityMessage = {
  type: 'PROVE_IDENTITY'
  payload: {
    challenge: Challenge
    proof: Base64 // this is a signature
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

export type UpdateMessage = {
  type: 'UPDATE'
  payload: {
    root: Hash
    head: Hash
    hashes: Hash[]
  }
}

export type MissingLinksMessage = {
  type: 'MISSING_LINKS'
  payload: {
    head: Hash
    links: TeamLink[]
  }
}

export type ContinueMessage = {
  type: 'CONTINUE'
  payload: {}
}

export type ConnectionMessage =
  | HelloMessage
  | AcceptInvitationMessage
  | ChallengeIdentityMessage
  | ProveIdentityMessage
  | AcceptIdentityMessage
  | ErrorMessage
  | DisconnectMessage
  | UpdateMessage
  | MissingLinksMessage
  | ContinueMessage

export type NumberedConnectionMessage = ConnectionMessage & {
  index: number
}
