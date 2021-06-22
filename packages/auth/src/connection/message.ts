import { Challenge } from '@/connection/types'
import { TeamAction, TeamLink } from '@/chain'
import { ProofOfInvitation } from '@/invitation'
import { KeyScope, PublicKeyset } from '@/keyset'
import { Base64, Hash } from '@/util'
import { SyncPayload } from '@/sync/types'

export type ReadyMessage = {
  type: 'READY'
}

/**
 * - If we're a member, we just authorize as a device. So all we provide is an identity claim for a device.
 * - If we're a new member with an invitation, we want to give them our user's public keys and our device's public keys.
 * - If we're a new device with an invitation, we just want to give them our device public keys.
 */
export type HelloMessage = {
  type: 'HELLO'
  payload:
    | {
        // I'm already a member
        identityClaim: KeyScope
      }
    | {
        // I have an invitation
        proofOfInvitation: ProofOfInvitation
        userKeys?: PublicKeyset // only for new member (not for new device)
        deviceKeys: PublicKeyset
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
    proof: Base64 // this is a signature
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
  payload: SyncPayload<TeamAction>
}

// triggered locally when we detect that team has changed
export type LocalUpdateMessage = {
  type: 'LOCAL_UPDATE'
  payload: { head: Hash }
}

// Negotiation

export type SeedMessage = {
  type: 'SEED'
  payload: {
    encryptedSeed: Base64
  }
}

// Communication

export type EncryptedMessage = {
  type: 'ENCRYPTED_MESSAGE'
  payload: Base64
}

export type ConnectionMessage =
  | ReadyMessage
  | HelloMessage
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
