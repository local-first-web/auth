import React from 'react'
import { PeerState, StoredPeerState, TeamContextPayload } from '../types'

export const TeamProvider = ({ initialState, onUpdate, children }: TeamProviderProps) => {
  const [peerState, setPeerState] = React.useState<PeerState>(initialState)

  React.useEffect(() => {
    // store state whenever it changes
    const { userName, user, device, team } = peerState
    const teamChain = team?.save()
    onUpdate({ userName, user, device, teamChain })
  }, [peerState])

  return <teamContext.Provider value={[peerState, setPeerState]} children={children} />
}

export const teamContext = React.createContext<TeamContextPayload>(undefined)

// TYPES

interface TeamProviderProps {
  initialState: PeerState
  onUpdate: (s: StoredPeerState) => void
  children: React.ReactNode
}
