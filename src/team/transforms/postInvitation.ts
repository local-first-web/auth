import { Invitation } from '/invitation'
import { Transform } from './index'

export const postInvitation = (invitation: Invitation): Transform => (state) => ({
  ...state,
  invitations: {
    ...state.invitations,
    [invitation.id]: invitation,
  },
})
