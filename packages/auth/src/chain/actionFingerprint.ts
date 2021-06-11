import { isRootLink, TeamAction, TeamActionLink } from '@/chain/types'
import { getDeviceId } from '@/device'

/** Identifies a unique action for the purpose of detecting duplicates;
 * e.g. ADD_MEMBER:bob
 */
export const actionFingerprint = (link: TeamActionLink) => {
  const fingerprintPayload = (action: TeamAction) => {
    switch (action.type) {
      case 'ADD_MEMBER':
        return action.payload.member.userName
      case 'REMOVE_MEMBER':
        return action.payload.userName
      case 'ADD_ROLE':
        return action.payload.roleName
      case 'ADD_MEMBER_ROLE':
      case 'REMOVE_MEMBER_ROLE':
        return `${action.payload.roleName}:${action.payload.userName}`
      case 'ADD_DEVICE':
        return getDeviceId(action.payload.device)
      case 'REMOVE_DEVICE':
        return getDeviceId(action.payload)
      case 'INVITE_MEMBER':
      case 'INVITE_DEVICE':
        return action.payload.invitation.id
      case 'REVOKE_INVITATION':
        return action.payload.id
      case 'ADMIT_MEMBER':
      case 'ADMIT_DEVICE':
        return action.payload.id
      case 'CHANGE_MEMBER_KEYS':
      case 'CHANGE_DEVICE_KEYS':
        return JSON.stringify(action.payload.keys)
      default:
        // ignore coverage
        return JSON.stringify(action.payload)
    }
  }

  if (isRootLink(link)) return 'ROOT'
  return `${link.body.type}:${fingerprintPayload(link.body)}`
}
