import { Reducer } from '/team/reducers/index'

export const revokeInvitation = (id: string): Reducer => state => {
  const invitations = { ...state.invitations }
  delete invitations[id]
  return {
    ...state,
    invitations,
  }
}
