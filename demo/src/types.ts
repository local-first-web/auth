import * as auth from '@localfirst/auth'
import { ConnectionManager } from 'ConnectionManager'
import { UUID } from 'crdx/dist/util'

export type UserName = string
export type ConnectionStatus = string

export type PeerState = {
  userName: UserName
  userId: UUID
  user?: auth.UserWithSecrets
  device: auth.DeviceWithSecrets
  team?: auth.Team
  teamState?: auth.TeamState
  connectionManager?: ConnectionManager
  online: boolean
  connectionStatus: Record<UserName, ConnectionStatus>
  alerts: AlertInfo[]
}

export type StoredPeerState = {
  userName: UserName
  userId: UUID
  user?: auth.UserWithSecrets
  device: auth.DeviceWithSecrets
  teamGraph?: string
  teamKeys?: auth.KeysetWithSecrets
}

export type Storage = Record<string, StoredPeerState>

export type TeamContextPayload =
  | [PeerState, React.Dispatch<React.SetStateAction<PeerState>>]
  | undefined

export interface AlertInfo {
  id: string
  message: string
  type: 'error' | 'warning' | 'info'
}
