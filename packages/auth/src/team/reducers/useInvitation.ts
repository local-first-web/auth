import { InvitationState } from '@/invitation'
import { Reducer } from '@/team/reducers/index'

export const useInvitation = (id: string): Reducer => state => {
  const invitations = { ...state.invitations }
  const invitationState: InvitationState = invitations[id]

  const uses = invitationState.uses + 1

  return {
    ...state,
    invitations: {
      ...invitations,
      [id]: {
        ...invitationState,
        uses,
      },
    },
  }
}
