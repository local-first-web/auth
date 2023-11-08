import type {
  Base58,
  Hash,
  KeyScope,
  Keyset,
  SyncState,
  UnixTimestamp,
  UserWithSecrets,
} from '@localfirst/crdx'
import type {
  FirstUseDeviceWithSecrets,
  DeviceWithSecrets,
  FirstUseDevice,
  Device,
} from 'device/index.js'
import type { ProofOfInvitation } from 'invitation/index.js'
import type { Member, Team } from 'team/index.js'
import type { ActionFunction, AssignAction, ConditionPredicate } from 'xstate'
import type { ConnectionErrorPayload } from './errors.js'
import type { ConnectionMessage } from './message.js'
import type { ServerWithSecrets } from 'server/index.js'

export type ConnectionEvents = {
  /** state change in the connection */
  change: (summary: string) => void

  /** message received from peer */
  message: (message: unknown) => void

  /** Our peer has detected an error and reported it to us, e.g. we tried to join with an invalid invitation. */
  remoteError: (error: ConnectionErrorPayload) => void

  /** We've detected an error locally, e.g. a peer tries to join with an invalid invitation. */
  localError: (error: ConnectionErrorPayload) => void

  /** We're connected to a peer and have been mutually authenticated. */
  connected: () => void

  /**
   * We've successfully joined a team using an invitation. This event provides the team graph and
   * the user's info (including keys). (When we're joining as a new device for an existing user,
   * this is how we get the user's keys.) This event gives the application a chance to persist the
   * team graph and the user's info.
   */
  joined: ({ team, user }: { team: Team; user: UserWithSecrets }) => void

  /** The team graph has been updated. This event gives the application a chance to persist the changes. */
  updated: () => void

  /** The auth connection disconnects from a peer after entering an error state. */
  disconnected: (event: ConnectionMessage) => void
}

// Identity

export type Challenge = KeyScope & {
  nonce: Base58
  timestamp: UnixTimestamp
}

// Context schema

export type SendFunction = (message: string) => void

export type MemberInitialContext = {
  user: UserWithSecrets
  device: DeviceWithSecrets
  team: Team
}

export type InviteeMemberInitialContext = {
  user: UserWithSecrets
  device: DeviceWithSecrets
  invitationSeed: string
}

export type InviteeDeviceInitialContext = {
  userName: string
  device: FirstUseDeviceWithSecrets
  invitationSeed: string
}

export type InviteeInitialContext = InviteeMemberInitialContext | InviteeDeviceInitialContext

export type ServerInitialContext = {
  server: ServerWithSecrets
  team: Team
}

/** The type of the initial context depends on whether we are already a member, or we've just been
 * invited and are connecting to the team for the first time. */
export type InitialContext = MemberInitialContext | InviteeInitialContext | ServerInitialContext

export type ConnectionParams = {
  /** A function to send messages to our peer. This how you hook this up to your network stack. */
  sendMessage: SendFunction

  /** The initial context. */
  context: InitialContext
}

export type ErrorPayload = {
  message: string
  details?: any
}

export type ConnectionContext = {
  theyHaveInvitation?: boolean

  theirIdentityClaim?: KeyScope
  theirUserName?: string
  theirProofOfInvitation?: ProofOfInvitation
  theirUserKeys?: Keyset
  theirDevice?: Device | FirstUseDevice

  challenge?: Challenge
  peer?: Member
  theirHead?: Hash
  seed?: Base58
  theirEncryptedSeed?: Base58
  sessionKey?: Base58
  error?: ErrorPayload
  syncState?: SyncState

  device: DeviceWithSecrets | FirstUseDeviceWithSecrets
} & Partial<InviteeDeviceInitialContext> &
  Partial<InviteeMemberInitialContext> &
  Partial<ServerInitialContext> &
  Partial<MemberInitialContext>

export type StateMachineAction =
  | ActionFunction<ConnectionContext, ConnectionMessage>
  | AssignAction<ConnectionContext, ConnectionMessage>
export type Condition = ConditionPredicate<ConnectionContext, ConnectionMessage>

// State schema
// This is the schema for protocolMachine.ts

export type ConnectionState = {
  states: {
    awaitingIdentityClaim: Record<string, unknown>

    authenticating: {
      states: {
        checkingInvitations: {
          states: {
            checkingForInvitations: Record<string, unknown>
            awaitingInvitationAcceptance: Record<string, unknown>
            validatingInvitation: Record<string, unknown>
          }
        }
        checkingIdentity: {
          states: {
            provingMyIdentity: {
              states: {
                awaitingIdentityChallenge: Record<string, unknown>
                awaitingIdentityAcceptance: Record<string, unknown>
                doneProvingMyIdentity: Record<string, unknown>
              }
            }
            verifyingTheirIdentity: {
              states: {
                challengingIdentity: Record<string, unknown>
                awaitingIdentityProof: Record<string, unknown>
                doneVerifyingTheirIdentity: Record<string, unknown>
              }
            }
          }
        }
        doneAuthenticating: Record<string, unknown>
      }
    }

    synchronizing: Record<string, unknown>

    negotiating: {
      states: {
        awaitingSeed: Record<string, unknown>
        doneNegotiating: Record<string, unknown>
      }
    }

    connected: Record<string, unknown>

    disconnected: Record<string, unknown>
  }
}

// Type guard: InviteeInitialContext vs others
export const isInvitee = (c: InitialContext | ConnectionContext): c is InviteeInitialContext =>
  !('team' in c)

// Type guard: InviteeMemberInitialContext vs InviteeDeviceInitialContext
export const isInviteeMember = (
  c: InviteeMemberInitialContext | InviteeDeviceInitialContext
): c is InviteeMemberInitialContext => 'user' in c

// Type guard: ServerInitialContext vs others
export const isServer = (c: InitialContext | ConnectionContext): c is ServerInitialContext =>
  'server' in c
