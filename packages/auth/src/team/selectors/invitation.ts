import { TeamState } from '@/team/types'
import { assert } from '@/util'
import { Hash } from '@/util/types'

export function hasInvitation(state: TeamState, id: Hash): boolean {
  return id in state.invitations
}

export function getInvitation(state: TeamState, id: Hash) {
  assert(hasInvitation(state, id), `No invitation with id '${id}' found.`)
  const invitation = state.invitations[id]
  return invitation
}
