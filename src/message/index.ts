export * from '/message/identity'
export * from '/message/sync'

import {
  ClaimIdentityMessage,
  ChallengeIdentityMessage,
  ProveIdentityMessage,
  AcceptIdentityMessage,
  RejectIdentityMessage,
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
  | AcceptIdentityMessage
  | RejectIdentityMessage

  // sync messages
  | SendHashesMessage
  | RequestLinksMessage
  | SendLinksMessage
