import { type InvitationState } from 'invitation/index.js'
import { type Transform } from 'team/types.js'

export const useInvitation =
  (id: string, invitee: string): Transform =>
  state => {
    const invitations = { ...state.invitations }
    const invitationState: InvitationState = invitations[id]

    const uses = invitationState.uses + 1

    // Recording who this invitation has admitted is what keeps a published proof from being spent
    // twice on the same invitee
    const admitted = [...invitationState.admitted, invitee]

    return {
      ...state,
      invitations: {
        ...invitations,
        [id]: {
          ...invitationState,
          uses,
          admitted,
        },
      },
    }
  }
