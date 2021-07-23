import { DeviceWithSecrets } from '@/device'
import { ProofOfInvitation } from '@/invitation'
import { SyncState } from '@/sync/types'
import { Member, Team } from '@/team'
import { Base58, Hash, UnixTimestamp } from '@/util'
import { KeyScope, Keyset, UserWithSecrets } from 'crdx'
import { ActionFunction, AssignAction, ConditionPredicate } from 'xstate'
import { ConnectionMessage } from './message'

// Identity

export type Challenge = KeyScope & {
  nonce: Base58
  timestamp: UnixTimestamp
}

// Context schema

export type SendFunction = <T extends ConnectionMessage>(message: T) => void

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
  device: DeviceWithSecrets
  invitationSeed: string
}

export type InviteeInitialContext = InviteeMemberInitialContext | InviteeDeviceInitialContext

/** The type of the initial context depends on whether we are already a member, or we've just been
 * invited and are connecting to the team for the first time. */
export type InitialContext = MemberInitialContext | InviteeInitialContext

// type guard: MemberInitialContext vs InviteeInitialContext
export const isInvitee = (c: InitialContext | ConnectionContext): c is InviteeInitialContext =>
  !('team' in c)

export interface ConnectionParams {
  /** A function to send messages to our peer. This how you hook this up to your network stack. */
  sendMessage: SendFunction
  context: InitialContext
  peerUserName?: string
}

export interface ErrorPayload {
  message: string
  details?: any
}

export interface ConnectionContext
  extends Partial<MemberInitialContext>,
    Partial<InviteeMemberInitialContext>,
    Partial<InviteeDeviceInitialContext> {
  theyHaveInvitation?: boolean
  theirIdentityClaim?: KeyScope

  theirProofOfInvitation?: ProofOfInvitation
  theirUserKeys?: Keyset
  theirDeviceKeys?: Keyset

  challenge?: Challenge
  peer?: Member
  theirHead?: Hash
  seed?: Base58
  theirEncryptedSeed?: Base58
  sessionKey?: Base58
  error?: ErrorPayload
  device: DeviceWithSecrets

  syncState?: SyncState
}

export type StateMachineAction =
  | ActionFunction<ConnectionContext, ConnectionMessage>
  | AssignAction<ConnectionContext, ConnectionMessage>
export type Condition = ConditionPredicate<ConnectionContext, ConnectionMessage>

// State schema

export interface ConnectionState {
  states: {
    idle: {}

    disconnected: {}

    connecting: {
      states: {
        invitation: {
          states: {
            initializing: {}
            waiting: {}
            validating: {}
          }
        }
        authenticating: {
          states: {
            proving: {
              states: {
                awaitingChallenge: {}
                awaitingAcceptance: {}
                done: {}
              }
            }
            verifying: {
              states: {
                challenging: {}
                waiting: {}
                done: {}
              }
            }
          }
        }
        done: {}
      }
    }

    synchronizing: {}

    negotiating: {
      states: {
        sendingSeed: {
          states: {
            sending: {}
            done: {}
          }
        }
        receivingSeed: {
          states: {
            waiting: {}
            done: {}
          }
        }
      }
    }

    connected: {}

    failure: {}
  }
}
