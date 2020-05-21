import { Invitation } from '/invitation'
import { Reducer } from './index'

export const postInvitation = (invitation: Invitation): Reducer => state => ({
  ...state,
  invitations: {
    ...state.invitations,
    [invitation.id]: invitation,
  },
})
