import { TeamState } from '@/team/types'
import { assert } from '@/util'
import { Base58 } from '@localfirst/crdx'

export function hasInvitation(state: TeamState, id: Base58): boolean {
  return id in state.invitations
}

export function getInvitation(state: TeamState, id: Base58) {
  assert(hasInvitation(state, id), `No invitation with id '${id}' found.`)
  const invitation = state.invitations[id]
  return invitation
}
