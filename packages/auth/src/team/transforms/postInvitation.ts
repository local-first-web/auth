import { Invitation } from '@/invitation'
import { Transform } from '@/team/types'

export const postInvitation =
  (invitation: Invitation): Transform =>
  state => {
    const invitationState = {
      ...invitation,
      uses: 0,
      revoked: false,
    }

    return {
      ...state,
      invitations: {
        ...state.invitations,
        [invitation.id]: invitationState,
      },
    }
  }
