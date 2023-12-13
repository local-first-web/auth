import React from 'react'
import { useTeam } from '../hooks/useTeam.js'
import { type PeerInfo } from '../peers.js'
import { Alerts } from './Alerts.js'
import { Avatar } from './Avatar.js'
import { CreateOrJoinTeam } from './CreateOrJoinTeam.js'
import { ErrorBoundary } from './ErrorBoundary.js'
import { HideButton } from './HideButton.js'
import { Team } from './Team.js'

const AUTO_CREATE_ALICE_TEAM = true

export const Peer = ({ peerInfo, onHide }: PeerProps) => {
  const { team, user, createTeam, disconnect } = useTeam()

  React.useEffect(() => {
    // set up Alice on first load
    if (!team && AUTO_CREATE_ALICE_TEAM && peerInfo.id === 'Alice:laptop') {
      createTeam()
    }
  }, [peerInfo.id])

  const hide = async () => {
    disconnect()
    onHide(peerInfo.id)
  }

  return (
    <ErrorBoundary>
      <div title={peerInfo.id} className="Peer group max-w-sm flex-1 bg-white shadow-md relative">
        <HideButton onClick={hide}></HideButton>
        <div className="Header flex items-center bg-teal-500 max-h-20">
          <div className="pl-4 py-4">
            <Avatar size="lg" className="bg-opacity-75" children={peerInfo.user.emoji} />
          </div>
          <h1
            className="text-white text-2xl font-extrabold flex-grow"
            children={peerInfo.user.userName}
          />
          <div style={{ fontSize: '5rem' }} className="pt-4">
            {peerInfo.device.emoji}
          </div>
        </div>
        <Alerts />
        {team && user ? (
          // Team members, sig chain, etc.
          <Team />
        ) : (
          // Not on a team; show Create team / Join team buttons
          <CreateOrJoinTeam />
        )}
      </div>
    </ErrorBoundary>
  )
}

type PeerProps = {
  peerInfo: PeerInfo
  onHide: (id: string) => void
}
