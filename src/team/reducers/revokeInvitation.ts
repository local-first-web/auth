import { Reducer } from './index'

export const revokeInvitation = (id: string): Reducer => state => {
  const invitations = { ...state.invitations }
  delete invitations[id]
  return {
    ...state,
    invitations,
  }
}
