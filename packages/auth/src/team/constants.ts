import { TeamState } from './types'

export const ALL = 'ALL'

export const initialState: TeamState = {
  teamName: '',
  members: [],
  roles: [],
  lockboxes: [],
  invitations: {},
  removedMembers: [], // this is a list of userNames
  removedDevices: [], // this is a list of deviceIds
}
