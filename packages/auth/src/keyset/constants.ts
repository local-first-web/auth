import { KeyType } from '@/keyset/types'
import { ADMIN } from '@/role'

export const TEAM_SCOPE = { type: KeyType.TEAM, name: KeyType.TEAM }
export const ADMIN_SCOPE = { type: KeyType.ROLE, name: ADMIN }
export const EPHEMERAL_SCOPE = { type: KeyType.EPHEMERAL, name: KeyType.EPHEMERAL }
