import { TeamState } from './teamState'
import { ADMIN_ROLE } from '../role'

export const initialState: TeamState = {
  teamName: '',
  members: [],
  roles: [ADMIN_ROLE],
}

export const ALL = 'ALL'
