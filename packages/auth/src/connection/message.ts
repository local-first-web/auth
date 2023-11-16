import type {
  Base58,
  Hash,
  KeyScope,
  Keyring,
  Keyset,
  SyncMessage as SyncPayload,
} from '@localfirst/crdx'
import type { ErrorMessage, LocalErrorMessage } from './errors.js'
import type { Challenge } from 'connection/types.js'
import type { ProofOfInvitation } from 'invitation/index.js'
import type { Device, FirstUseDevice } from 'index.js'

export type ReadyMessage = {
  type: 'REQUEST_IDENTITY'
}

export type ClaimIdentityMessage = {
  type: 'CLAIM_IDENTITY'
  payload:
    | {
        // I'm already a member, I just send my deviceId
        identityClaim: KeyScope // { type: 'DEVICE', name: deviceId }
      }
    | {
        // I'm a new user and I have an invitation
        proofOfInvitation: ProofOfInvitation
        userName: string | undefined
        userKeys: Keyset
        device: Device
      }
    | {
        // I'm a new device for an existing user and I have an invitation
        proofOfInvitation: ProofOfInvitation
        userName: string | undefined
        device: FirstUseDevice
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
    serializedGraph: Base58
    teamKeyring: Keyring
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
    proof: Base58 // This is a signature
  }
}

export type AcceptIdentityMessage = {
  type: 'ACCEPT_IDENTITY'
  payload: Record<string, unknown>
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
  payload: SyncPayload
}

// Triggered locally when we detect that team has changed
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
  | AcceptIdentityMessage
  | AcceptInvitationMessage
  | ChallengeIdentityMessage
  | ClaimIdentityMessage
  | DisconnectMessage
  | EncryptedMessage
  | ErrorMessage
  | LocalErrorMessage
  | LocalUpdateMessage
  | ProveIdentityMessage
  | ReadyMessage
  | ReconnectMessage
  | SeedMessage
  | SyncMessage

export type NumberedConnectionMessage = ConnectionMessage & {
  index: number
}

const messageTypes = new Set([
  'ACCEPT_IDENTITY',
  'ACCEPT_INVITATION',
  'CHALLENGE_IDENTITY',
  'CLAIM_IDENTITY',
  'DISCONNECT',
  'ENCRYPTED_MESSAGE',
  'ERROR',
  'LOCAL_ERROR',
  'LOCAL_UPDATE',
  'PROVE_IDENTITY',
  'RECONNECT',
  'REJECT_IDENTITY',
  'REQUEST_IDENTITY',
  'SEED',
  'SYNC',
])

export function isNumberedConnectionMessage(
  message: ConnectionMessage
): message is NumberedConnectionMessage {
  return (
    'index' in message &&
    typeof message.index === 'number' && //
    'type' in message &&
    messageTypes.has(message.type)
  )
}
