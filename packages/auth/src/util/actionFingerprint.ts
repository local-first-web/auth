// ignore file coverage
import type { TeamAction, TeamLink } from '../team/types.js'

/**
 * Identifies a unique action for the purpose of detecting duplicates; e.g. `ADD_MEMBER:bob`.
 *
 * This has to be total — it can't throw for any input, whatever is or isn't on the payload. Every
 * validation failure calls it to label the refusal, and a link with nothing on it is one of the
 * things links get refused FOR: if building the message threw, the refusal would come out as a
 * TypeError from the middle of a replay, which is the failure the refusal exists to replace.
 */
export const actionFingerprint = (link: TeamLink) => {
  try {
    const action = link.body as TeamAction
    if (action.type === 'ROOT') return 'ROOT'

    return `${String(action.type)}:${fingerprintPayload(action)}`
  } catch {
    // Belt and braces: nothing above should throw, and if it ever does, a label is not worth
    // losing the refusal over
    return 'unknown'
  }
}

const fingerprintPayload = (action: TeamAction): string => {
  // Everything below reads a field off the payload, so there has to be one
  const payload = action.payload as Record<string, any> | undefined
  if (payload === undefined || payload === null) return 'none'

  switch (action.type) {
    case 'ADD_MEMBER': {
      return describe(payload.member?.userId)
    }

    case 'REMOVE_MEMBER': {
      return describe(payload.userId)
    }

    case 'ADD_ROLE': {
      return describe(payload.roleName)
    }

    case 'ADD_MEMBER_ROLE':
    case 'REMOVE_MEMBER_ROLE': {
      return `${describe(payload.roleName)}:${describe(payload.userId)}`
    }

    case 'ADD_DEVICE': {
      return describe(payload.device?.deviceId)
    }

    case 'REMOVE_DEVICE': {
      return describe(payload.deviceId)
    }

    case 'INVITE_MEMBER':
    case 'INVITE_DEVICE': {
      return describe(payload.invitation?.id)
    }

    case 'REVOKE_INVITATION':
    case 'ADMIT_MEMBER':
    case 'ADMIT_DEVICE': {
      return describe(payload.id)
    }

    case 'CHANGE_MEMBER_KEYS': {
      return stringify(payload.keys)
    }

    default: {
      // ignore coverage
      return stringify(payload)
    }
  }
}

/** A field that may not be there, and may not be a string even if it is */
const describe = (value: unknown) => (typeof value === 'string' ? value : stringify(value))

/** `JSON.stringify` returns `undefined` for some inputs and throws on circular ones */
const stringify = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? 'none'
  } catch {
    return 'none'
  }
}
