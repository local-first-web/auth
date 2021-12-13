import { ADMIN } from '@/role'
import { KeyScope, KeyType } from 'crdx'
import { TeamState } from './types'

export const ALL = 'ALL'

export const initialState: TeamState = {
  teamName: '',
  members: [],
  roles: [],
  lockboxes: [],
  invitations: {},
  removedMembers: [],
  removedDevices: [],
  pendingKeyRotations: {},
}

export const TEAM_SCOPE = { type: KeyType.TEAM, name: KeyType.TEAM } as KeyScope
export const ADMIN_SCOPE = { type: KeyType.ROLE, name: ADMIN } as KeyScope
export const EPHEMERAL_SCOPE = {
  type: KeyType.EPHEMERAL,
  name: KeyType.EPHEMERAL,
} as KeyScope
