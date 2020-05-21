import { ADMIN_ROLE } from '/role'
import { TeamState } from '/team/types'

export const initialState: TeamState = {
  teamName: '',
  members: [],
  roles: [ADMIN_ROLE],
  lockboxes: {},
  invitations: {},
}

export const ALL = 'ALL'
