import { Transform } from './index'

export const revokeInvitation = (id: string): Transform => (state) => {
  const invitations = { ...state.invitations }
  delete invitations[id]
  return {
    ...state,
    invitations,
  }
}
