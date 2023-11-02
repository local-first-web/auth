import type * as auth from '@localfirst/auth'
import { type Repo } from '@automerge/automerge-repo'

export type UserName = string
export type ConnectionStatus = string

export type PeerState = {
  userName: UserName
  userId: string
  user?: auth.UserWithSecrets
  device: auth.DeviceWithSecrets
  team?: auth.Team
  teamState?: auth.TeamState
  repo?: Repo
  online: boolean
  connectionStatus: Record<UserName, ConnectionStatus>
  alerts: AlertInfo[]
}

export type StoredPeerState = {
  userName: UserName
  userId: string
  user?: auth.UserWithSecrets
  device: auth.DeviceWithSecrets
  teamGraph?: string
  teamKeys?: auth.KeysetWithSecrets
}

export type Storage = Record<string, StoredPeerState>

export type TeamContextPayload =
  | [PeerState, React.Dispatch<React.SetStateAction<PeerState>>]
  | undefined

export type AlertInfo = {
  id: string
  message: string
  type: 'error' | 'warning' | 'info'
}
