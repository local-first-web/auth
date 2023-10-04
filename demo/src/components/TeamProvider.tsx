import React from 'react'
import { PeerState, StoredPeerState, TeamContextPayload } from '../types.js'

export const TeamProvider = ({ initialState, onUpdate, children }: TeamProviderProps) => {
  const [peerState, setPeerState] = React.useState<PeerState>(initialState)

  React.useEffect(() => {
    // store state whenever it changes
    const { team } = peerState
    const teamGraph = team?.save()
    onUpdate({ ...peerState, teamGraph })
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
