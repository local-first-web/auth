import { Invitation } from '/invitation'
import { Reducer } from '/team/reducers/index'

export const postInvitation = (invitation: Invitation): Reducer => state => ({
  ...state,
  invitations: {
    ...state.invitations,
    [invitation.id]: invitation,
  },
})
