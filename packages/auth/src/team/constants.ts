import { ADMIN } from '@/role'
import { KeyType } from '@/util'
import { KeyScope } from 'crdx'
import { TeamState } from './types'

export const ALL = 'ALL'

export const initialState: TeamState = {
  head: [],
  teamName: '',
  members: [],
  servers: [],
  roles: [],
  lockboxes: [],
  invitations: {},
  removedMembers: [],
  removedDevices: [],
  removedServers: [],
  pendingKeyRotations: [],
}

export const TEAM_SCOPE = { type: KeyType.TEAM, name: KeyType.TEAM } as KeyScope
export const ADMIN_SCOPE = { type: KeyType.ROLE, name: ADMIN } as KeyScope
export const EPHEMERAL_SCOPE = {
  type: KeyType.EPHEMERAL,
  name: KeyType.EPHEMERAL,
} as KeyScope
