import { TeamLinkBody } from '/chain'

export const isAdminOnlyAction = (action: TeamLinkBody) => {
  // any team member can do these things
  const nonAdminActions = ['ADD_DEVICE', 'CHANGE_MEMBER_KEYS', 'CHANGE_DEVICE_KEYS', 'ADMIT']

  return !nonAdminActions.includes(action.type)
}
