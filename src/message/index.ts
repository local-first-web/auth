export * from '/message/identity'
export * from '/message/sync'
import {
  ACCEPT_IDENTITY,
  ChallengeIdentityMessage,
  ClaimIdentityMessage,
  ProveIdentityMessage,
  REJECT_IDENTITY,
} from '/message/identity'
import { SendHashes } from '/message/sync'

export type Message =
  // identity messages
  | ClaimIdentityMessage
  | ChallengeIdentityMessage
  | ProveIdentityMessage
  | typeof ACCEPT_IDENTITY
  | typeof REJECT_IDENTITY
  // sync messages
  | SendHashes
