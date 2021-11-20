import { Challenge } from '@/connection/types'
import { ProofOfInvitation } from '@/invitation'
import { SyncMessage as SyncPayload } from 'crdx'
import { TeamAction, TeamContext } from '@/team'
import { Base58, Hash } from '@/util'
import { KeyScope, Keyset } from 'crdx'

export type ReadyMessage = {
  type: 'REQUEST_IDENTITY'
}

/**
 * - If we're a member, we just authorize as a device. So all we provide is an identity claim for a
 *   device.
 * - If we're a new member with an invitation, we want to give them our user's public keys and our
 *   device's public keys.
 * - If we're a new device with an invitation, we just want to give them our device public keys.
 */
export type ClaimIdentityMessage = {
  type: 'CLAIM_IDENTITY'
  payload:
    | {
        // I'm already a member
        identityClaim: KeyScope
      }
    | {
        // I have an invitation
        proofOfInvitation: ProofOfInvitation
        userKeys?: Keyset // only for new member (not for new device)
        deviceKeys: Keyset
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

export type ReconnectMessage = {
  type: 'RECONNECT'
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
    proof: Base58 // this is a signature
  }
}

export type AcceptIdentityMessage = {
  type: 'ACCEPT_IDENTITY'
  payload: {}
}

export type RejectIdentityMessage = {
  type: 'REJECT_IDENTITY'
  payload: {
    message: string
  }
}

// Update (synchronization)

export type SyncMessage = {
  type: 'SYNC'
  payload: SyncPayload<TeamAction, TeamContext>
}

// triggered locally when we detect that team has changed
export type LocalUpdateMessage = {
  type: 'LOCAL_UPDATE'
  payload: { head: Hash[] }
}

// Negotiation

export type SeedMessage = {
  type: 'SEED'
  payload: {
    encryptedSeed: Base58
  }
}

// Communication

export type EncryptedMessage = {
  type: 'ENCRYPTED_MESSAGE'
  payload: Base58
}

export type ConnectionMessage =
  | ReadyMessage
  | ClaimIdentityMessage
  | AcceptInvitationMessage
  | ChallengeIdentityMessage
  | ProveIdentityMessage
  | AcceptIdentityMessage
  | ErrorMessage
  | DisconnectMessage
  | ReconnectMessage
  | SyncMessage
  | LocalUpdateMessage
  | SeedMessage
  | EncryptedMessage

export type NumberedConnectionMessage = ConnectionMessage & {
  index: number
}
