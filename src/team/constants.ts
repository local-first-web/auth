import { TeamState } from '/team/types'
import { ADMIN_ROLE } from '/role'

export const initialState: TeamState = {
  teamName: '',
  members: [],
  roles: [ADMIN_ROLE],
  lockboxes: {},
}

export const ALL = 'ALL'
