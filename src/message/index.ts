export * from '/message/identity'
export * from '/message/sync'

import {
  ClaimIdentityMessage,
  ChallengeIdentityMessage,
  ProveIdentityMessage,
  ACCEPT_IDENTITY,
  REJECT_IDENTITY,
} from '/message/identity'
import {
  SendHashesMessage, //
  RequestLinksMessage,
  SendLinksMessage,
} from '/message/sync'

export type Message =
  // identity messages
  | ClaimIdentityMessage
  | ChallengeIdentityMessage
  | ProveIdentityMessage
  | typeof ACCEPT_IDENTITY
  | typeof REJECT_IDENTITY

  // sync messages
  | SendHashesMessage
  | RequestLinksMessage
  | SendLinksMessage
