import { Storage, PeerState, StoredPeerState } from '../types'
import * as React from 'react'
import * as auth from '@localfirst/auth'
import { PeerInfo, peers as allPeers } from '../peers'
import { Chooser } from './Chooser'
import { Peer } from './Peer'
import { TeamProvider } from './TeamProvider'
import debug from 'debug'

// 👩🏾💻 Add Alice's laptop by default
allPeers['Alice:laptop'].show = true
const defaults = { online: false, connectionStatus: {}, alerts: [] }

export const App = () => {
  const [peers, setPeers] = React.useState(allPeers)
  const [storage, setStorage] = React.useState<Storage>({})

  const setShow = (v: boolean) => (id: string) =>
    setPeers(peers => ({ ...peers, [id]: { ...peers[id], show: v } }))

  const onUpdate = (s: StoredPeerState) => {
    const peerId = s.user.userName + ':' + s.device.deviceName
    setStorage(prev => ({ ...prev, [peerId]: s }))
  }

  const getInitialState = (peerInfo: PeerInfo): PeerState => {
    const peerId = `${peerInfo.user.name}:${peerInfo.device.name}`
    const storedState = storage[peerId]
    if (storedState) {
      const { user, device, teamChain } = storedState
      const team = teamChain ? auth.loadTeam(teamChain, { user, device }) : undefined
      return { ...defaults, user, device, team }
    } else {
      const user = auth.createUser(peerInfo.user.name)
      const device = auth.createDevice(peerInfo.user.name, peerInfo.device.name)
      setStorage(prev => ({ ...prev, [peerId]: { user, device } }))
      return { ...defaults, user, device }
    }
  }

  return (
    <div className="App flex p-3 gap-3" style={{ minWidth: 2400 }}>
      {Object.values(peers)
        .filter(p => p.show)
        .map(p => (
          <TeamProvider key={p.id} initialState={getInitialState(p)} onUpdate={onUpdate}>
            <Peer onRemove={setShow(false)} peerInfo={p}></Peer>
          </TeamProvider>
        ))}
      <Chooser onAdd={setShow(true)} peers={peers}></Chooser>
    </div>
  )
}
