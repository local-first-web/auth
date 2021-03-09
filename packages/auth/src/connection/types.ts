import { ActionFunction, AssignAction, ConditionPredicate } from 'xstate'
import { ConnectionMessage } from '@/connection/message'
import { DeviceWithSecrets } from '@/device'
import { Invitee, ProofOfInvitation } from '@/invitation'
import { KeyScope } from '@/keyset'
import { Member } from '@/member'
import { Team } from '@/team'
import { User } from '@/user'
import { Base64, Hash, UnixTimestamp } from '@/util'

// Identity

export type Challenge = KeyScope & {
  nonce: Base64
  timestamp: UnixTimestamp
}

// Context schema

export type SendFunction = <T extends ConnectionMessage>(message: T) => void

/** The type of the initial context depends on whether we are already a member, or we've just been
 * invited and are connecting to the team for the first time. */
export type InitialContext = MemberInitialContext | InviteeInitialContext

export type MemberInitialContext = {
  /** The local user, including their secret keys  */
  user: User

  /** Information about the local device, including secret keys */
  device: DeviceWithSecrets

  /** The team object we both belong to */
  team: Team
}

export type InviteeInitialContext = {
  /** The local user, including their secret keys (not available if this is a device joining) */
  user?: User

  /** Information about the local device, including secret keys */
  device: DeviceWithSecrets

  /** The type and name associated with the invitation
   * (e.g. `{type: MEMBER, name: userName}` or `{type: DEVICE, name: deviceID}`) */
  invitee: Invitee

  /** The secret invitation seed that we've been given  */
  invitationSeed: string
}

// type guard: MemberInitialContext vs InviteeInitialContext
export const hasInvitee = (
  c: MemberInitialContext | InviteeInitialContext | ConnectionContext
): c is InviteeInitialContext => 'invitee' in c

export interface ConnectionParams {
  /** A function to send messages to our peer. This is one way to hook this up to your network stack -
   * alternatively you can use the streaming interface.
   */
  sendMessage?: SendFunction

  context: InitialContext
}

export interface ErrorPayload {
  message: string
  details?: any
}

export interface ConnectionContext
  extends Partial<MemberInitialContext>,
    Partial<InviteeInitialContext> {
  theyHaveInvitation?: boolean
  theirIdentityClaim?: KeyScope
  theirProofOfInvitation?: ProofOfInvitation
  challenge?: Challenge
  peer?: Member
  theirHead?: Hash
  seed?: Base64
  theirEncryptedSeed?: Base64
  sessionKey?: Base64
  error?: ErrorPayload
  device: DeviceWithSecrets
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
    synchronizing: {
      states: {
        sendingUpdate: {}
        receivingUpdate: {}
        sendingMissingLinks: {}
        receivingMissingLinks: {}
        waiting: {}
        done: {}
      }
    }
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
