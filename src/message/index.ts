export * from '/message/connection'
export * from '/message/sync'

import * as connection from '/message/connection'

import * as sync from '/message/sync'

export type ConnectionMessage =
  | connection.HelloMessage
  | connection.AcceptInvitationMessage
  | connection.ChallengeIdentityMessage
  | connection.ProveIdentityMessage
  | connection.AcceptIdentityMessage
  | connection.ErrorMessage
  | connection.DisconnectMessage

export type SyncMessage =
  | sync.SendHashesMessage //
  | sync.RequestLinksMessage
  | sync.SendLinksMessage

export type Message =
  | ConnectionMessage //
  | SyncMessage
