import React from 'react'
import {
  type PeerState,
  type StoredPeerState,
  type TeamContextPayload,
} from '../types.js'
import { RepoContext } from '@automerge/automerge-repo-react-hooks'
import { Repo } from '@automerge/automerge-repo'
import { LocalFirstAuthProvider } from '@automerge/automerge-repo-auth-localfirst'
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel'
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { device } from '@localfirst/auth'

export const TeamProvider = ({
  initialState,
  onUpdate,
  children,
}: TeamProviderProps) => {
  const [peerState, setPeerState] = React.useState<PeerState>(initialState)


  const userDeviceContext = { user: peerState.user, device: peerState.device }
  const authProvider = new LocalFirstAuthProvider(userDeviceContext)
  const repo = new Repo({
    authProvider,
    network: [
      new BroadcastChannelNetworkAdapter(),
      new BrowserWebSocketClientAdapter("ws://localhost:3030"),
    ],
  })


  React.useEffect(() => {
    // store state whenever it changes
    const { team } = peerState
    const teamGraph = team?.save()
    onUpdate({ ...peerState, teamGraph })
  }, [peerState])

  return (
    <RepoContext.Provider value={peerState.repo})>
      <teamContext.Provider
      value={[peerState, setPeerState]}
      children={children}
      />
    </RepoContext.Provider>
  )
}

export const teamContext = React.createContext<TeamContextPayload>(undefined)

// TYPES

type TeamProviderProps = {
  initialState: PeerState
  onUpdate: (s: StoredPeerState) => void
  children: React.ReactNode
}
