import { Reducer } from '@/team/reducers/index'

export const revokeInvitation = (id: string): Reducer => state => {
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
