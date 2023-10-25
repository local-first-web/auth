export const connectionErrors: Record<string, ErrorDefinition> = {
  MEMBER_UNKNOWN: {
    localMessage: 'The peer is not a member of this team',
    remoteMessage: 'You are not a member of this team',
  },
  MEMBER_REMOVED: {
    localMessage: 'The peer was removed from this team',
    remoteMessage: 'You were removed from this team',
  },
  DEVICE_UNKNOWN: {
    localMessage: "The peer's device isn't listed on this team",
    remoteMessage: "Your device isn't listed on this team",
  },
  DEVICE_REMOVED: {
    localMessage: "The peer's device was removed from this team",
    remoteMessage: 'Your device was removed from this team',
  },
  NEITHER_IS_MEMBER: {
    localMessage:
      'The peer is also holding an invitation and cannot admit you to the team',
    remoteMessage:
      'The peer is also holding an invitation and cannot admit you to the team',
  },
  IDENTITY_PROOF_INVALID: {
    localMessage: "The peer's proof of identity is not valid",
    remoteMessage: "Your proof of identity isn't valid",
  },
  INVITATION_PROOF_INVALID: {
    localMessage: "The peer's invitation wasn't accepted",
    remoteMessage: "Your invitation wasn't accepted",
  },
  JOINED_WRONG_TEAM: {
    localMessage: "This isn't the team you were invited to",
    remoteMessage: "This isn't the team the peer was invited to",
  },
  TIMEOUT: {
    localMessage: "We didn't hear back from the peer; giving up",
    remoteMessage: "The peer didn't hear back from us, so they gave up",
  },
}

/** Creates an error payload with an appropriate message for the local or remote user */
export const buildError = (
  type: ConnectionErrorType,
  details?: unknown,
  destination: 'LOCAL' | 'REMOTE' = 'LOCAL'
): ErrorMessage | LocalErrorMessage => {
  const { localMessage, remoteMessage } = connectionErrors[type]
  const message = destination === 'LOCAL' ? localMessage : remoteMessage
  const messageType = destination === 'LOCAL' ? 'LOCAL_ERROR' : 'ERROR'
  return { type: messageType, payload: { type, message, details } }
}

// Types

export type ErrorDefinition = {
  localMessage: string
  remoteMessage: string
}

export type ConnectionErrorType = keyof typeof connectionErrors

export type ConnectionErrorPayload = {
  type: ConnectionErrorType
  message: string
  details?: any
}

// Error messages received from the peer
export type ErrorMessage = {
  type: 'ERROR'
  payload: ConnectionErrorPayload
}

// Errors detected locally
export type LocalErrorMessage = {
  type: 'LOCAL_ERROR'
  payload: ConnectionErrorPayload
}
