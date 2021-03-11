import { Card, CardBody } from '@windmill/react-ui'
import React from 'react'
import { PeerInfo } from '../peers'
import { Alerts } from './Alerts'
import { Avatar } from './Avatar'
import { CreateOrJoinTeam } from './CreateOrJoinTeam'
import { ErrorBoundary } from './ErrorBoundary'
import { usePeerState } from './PeerStateProvider'
import { RemoveButton } from './RemoveButton'
import { Team } from './Team'

export const Peer = ({ peer, onRemove }: PeerProps) => {
  const { peerState, clearAlert, createTeam, joinTeam, connect } = usePeerState()

  const { team, user, device, connectionManager, connectionStatus = {} } = peerState

  const remove = async () => {
    await connectionManager?.disconnectServer()
    onRemove(peer.id)
  }

  return (
    <ErrorBoundary>
      {/* TODO: can't have nested tailwindcss groups, so need to do custom css for group-hover */}

      <Card className="Peer group max-w-sm flex-1 bg-white shadow-md relative">
        <RemoveButton onClick={remove}></RemoveButton>
        <CardBody className="Header flex items-center bg-teal-500">
          <Avatar size="lg" className="bg-opacity-75" children={peer.user.emoji} />
          <h1 className="text-white text-2xl font-extrabold flex-grow" children={peer.user.name} />
          <Avatar size="sm" children={peer.device.emoji} />
        </CardBody>
        <Alerts alerts={peerState.alerts} clearAlert={clearAlert} />
        {team ? (
          <Team user={user} device={peer.device} team={team} connections={connectionStatus} />
        ) : (
          <CreateOrJoinTeam user={user} createTeam={createTeam} joinTeam={joinTeam} />
        )}
      </Card>
    </ErrorBoundary>
  )
}

interface PeerProps {
  peer: PeerInfo
  onRemove: (id: string) => void
}
