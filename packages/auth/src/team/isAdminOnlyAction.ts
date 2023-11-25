import { type TeamAction, type TeamLinkBody } from './types.js'

export const isAdminOnlyAction = (action: TeamLinkBody) => {
  // Any team member can do these things
  const nonAdminActions: Array<TeamAction['type']> = [
    'INVITE_DEVICE',
    'ADD_DEVICE',
    'REMOVE_DEVICE',
    'CHANGE_MEMBER_KEYS',
    'CHANGE_DEVICE_KEYS',
    'CHANGE_SERVER_KEYS',
    'ADMIT_MEMBER',
    'ADMIT_DEVICE',
  ]

  return !nonAdminActions.includes(action.type)
}
