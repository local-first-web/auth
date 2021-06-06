import { Invitation } from '@/invitation'
import { Reducer } from '@/team/reducers/index'

export const postInvitation = (invitation: Invitation): Reducer => state => {
  const invitationState = {
    ...invitation,
    uses: 0,
    revoked: false,
    expired: false,
  }

  return {
    ...state,
    invitations: {
      ...state.invitations,
      [invitation.id]: invitationState,
    },
  }
}
