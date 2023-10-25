import { type Transform } from '@/team/types.js'

export const revokeInvitation =
  (id: string): Transform =>
  state => {
    const invitations = { ...state.invitations }
    const revokedInvitation = { ...invitations[id], revoked: true }

    return {
      ...state,
      invitations: {
        ...invitations,
        [id]: revokedInvitation,
      },
    }
  }
