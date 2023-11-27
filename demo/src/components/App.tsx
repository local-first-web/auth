import * as auth from '@localfirst/auth'
import React from 'react'
import { type PeerInfo, peers as allPeers } from '../peers'
import { type PeerState, type Storage, type StoredPeerState } from '../types.js'
import { Chooser } from './Chooser.js'
import { Peer } from './Peer.js'
import { TeamProvider } from './TeamProvider.js'

// 👩🏾💻 Add Alice's laptop by default
allPeers['Alice:laptop'].show = true
const defaults = { online: false, connectionStatus: {}, alerts: [] }

export const App = () => {
  const [peers, setPeers] = React.useState(allPeers)
  const [storage, setStorage] = React.useState<Storage>({})

  const setShow = (v: boolean) => (id: string) =>
    setPeers(peers => ({
      ...peers,
      [id]: {
        ...peers[id],
        show: v,
      },
    }))

  const onUpdate = (s: StoredPeerState) => {
    if (s.user) {
      const peerId = `${s.user.userId}:${s.device.deviceName}`
      setStorage(prev => ({ ...prev, [peerId]: s }))
    }
  }

  const getInitialState = (peerInfo: PeerInfo): PeerState => {
    const peerId = `${peerInfo.user.userId}:${peerInfo.device.name}`
    const storedState = storage[peerId]
    if (storedState) {
      // we're re-showing a peer that was previously hidden - we still have its state
      const { user, teamGraph, teamKeys } = storedState
      const team =
        user && teamGraph && teamKeys
          ? auth.loadTeam(teamGraph, { ...storedState, user }, teamKeys)
          : undefined
      return { ...defaults, ...storedState, team }
    }

    // we're showing a peer for the first time
    const { userId, userName } = peerInfo.user

    const device = auth.createDevice(userId, peerInfo.device.name)

    const user =
      peerInfo.device.name === 'laptop'
        ? // For the purposes of this demo, we're using the laptop as each user's "primary" device --
          // that's where their user keys are created.
          auth.createUser(userName, userId)
        : // On the phone, we only know the user's name. We don't have any user keys yet,
          // we'll get them once the device joins the team.
          undefined

    const state = { userName, userId, user, device }
    setStorage(prev => ({ ...prev, [peerId]: state }))
    return { ...defaults, ...state }
  }

  return (
    <div className="App flex p-3 gap-3" style={{ minWidth: 2400 }}>
      {Object.values(peers)
        .filter(p => p.show)
        .map(p => (
          <TeamProvider key={p.id} initialState={getInitialState(p)} onUpdate={onUpdate}>
            <Peer onHide={setShow(false)} peerInfo={p}></Peer>
          </TeamProvider>
        ))}
      <Chooser onAdd={setShow(true)} peers={peers}></Chooser>
    </div>
  )
}
