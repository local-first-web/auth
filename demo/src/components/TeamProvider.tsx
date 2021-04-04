import * as React from 'react'
import { PeerInfo } from '../peers'
import { PeerState, StoredPeerState, TeamContextPayload } from '../types'
import debug from 'debug'

export const TeamProvider = ({ initialState, onUpdate, children }: TeamProviderProps) => {
  const [peerState, setPeerState] = React.useState<PeerState>(initialState)

  React.useEffect(() => {
    // store state whenever it changes
    const { user, device, team } = peerState
    const teamChain = team?.save()
    onUpdate({ user, device, teamChain })
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
