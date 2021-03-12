import * as auth from '@localfirst/auth'
import * as React from 'react'
import { PeerInfo } from '../peers'
import { PeerState } from '../hooks/useTeam'

export const TeamProvider = ({ peerInfo, children }: TeamProviderProps) => {
  const [peerState, setPeerState] = React.useState<PeerState>(() => {
    return {
      user: auth.createUser(peerInfo.user.name),
      device: auth.createDevice(peerInfo.user.name, peerInfo.device.name),
      connectionStatus: {},
      alerts: [],
    }
  })

  return <teamContext.Provider value={[peerState, setPeerState]} children={children} />
}

export const teamContext = React.createContext<TeamContextPayload>(undefined)

// TYPES

type TeamContextPayload = [PeerState, React.Dispatch<React.SetStateAction<PeerState>>] | undefined

interface TeamProviderProps {
  peerInfo: PeerInfo
  children: React.ReactNode
}
