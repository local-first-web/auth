import { Reducer } from '@/team/reducers/index'

export const useInvitation = (id: string): Reducer => state => {
  const invitations = { ...state.invitations }
  const usedInvitation = { ...invitations[id], used: true }

  return {
    ...state,
    invitations: {
      ...invitations,
      [id]: usedInvitation,
    },
  }
}
