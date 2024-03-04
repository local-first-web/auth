export const DEVICE_REMOVED = 'DEVICE_REMOVED' as const
export const DEVICE_UNKNOWN = 'DEVICE_UNKNOWN' as const
export const IDENTITY_PROOF_INVALID = 'IDENTITY_PROOF_INVALID' as const
export const INVITATION_PROOF_INVALID = 'INVITATION_PROOF_INVALID' as const
export const JOINED_WRONG_TEAM = 'JOINED_WRONG_TEAM' as const
export const MEMBER_REMOVED = 'MEMBER_REMOVED' as const
export const NEITHER_IS_MEMBER = 'NEITHER_IS_MEMBER' as const
export const SERVER_REMOVED = 'SERVER_REMOVED' as const
export const TIMEOUT = 'TIMEOUT' as const

export const connectionErrors: Record<string, ErrorDefinition> = {
  [DEVICE_REMOVED]: {
    localMessage: "The peer's device was removed from this team",
    remoteMessage: 'Your device was removed from this team',
  },
  [DEVICE_UNKNOWN]: {
    localMessage: "The peer's device isn't listed on this team",
    remoteMessage: "Your device isn't listed on this team",
  },
  [IDENTITY_PROOF_INVALID]: {
    localMessage: "The peer's proof of identity is not valid",
    remoteMessage: "Your proof of identity isn't valid",
  },
  [INVITATION_PROOF_INVALID]: {
    localMessage: "The peer's invitation wasn't accepted",
    remoteMessage: "Your invitation wasn't accepted",
  },
  [JOINED_WRONG_TEAM]: {
    localMessage: "This isn't the team you were invited to",
    remoteMessage: "This isn't the team the peer was invited to",
  },
  [MEMBER_REMOVED]: {
    localMessage: 'The peer was removed from this team',
    remoteMessage: 'You were removed from this team',
  },
  [NEITHER_IS_MEMBER]: {
    localMessage: 'The peer is also holding an invitation and cannot admit you to the team',
    remoteMessage: 'The peer is also holding an invitation and cannot admit you to the team',
  },
  [SERVER_REMOVED]: {
    localMessage: 'The server was removed from this team',
    remoteMessage: 'You (a server) were removed from this team',
  },
  [TIMEOUT]: {
    localMessage: "We didn't hear back from the peer; giving up",
    remoteMessage: "The peer didn't hear back from you, so they gave up",
  },
}

/** Creates an error payload with an appropriate message for the local or remote user */
export const createErrorMessage = (
  type: ConnectionErrorType,
  destination: 'LOCAL' | 'REMOTE' = 'LOCAL'
): ErrorMessage | LocalErrorMessage => {
  const { localMessage, remoteMessage } = connectionErrors[type]
  const message = destination === 'LOCAL' ? localMessage : remoteMessage
  const messageType = destination === 'LOCAL' ? 'LOCAL_ERROR' : 'ERROR'
  return { type: messageType, payload: { type, message } }
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
