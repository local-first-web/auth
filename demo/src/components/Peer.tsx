import { Card, CardBody } from '@windmill/react-ui'
import debug from 'debug'
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

  const log = debug(`lf:tc:peer:${user.userName}`)

  React.useEffect(() => {
    if (peer.team) {
      // log('reconnecting to', peer.team.teamName)
      // setTeam(peer.team)
      const context = { user, device, team: peer.team }
      connect(peer.team.teamName, context)
    } else {
      // set up Alice on first load
      const AUTO_CREATE_ALICE_TEAM = true
      if (AUTO_CREATE_ALICE_TEAM && isAlice(peer)) createTeam()
    }
  }, [peer])

  const remove = async () => {
    await connectionManager?.disconnectServer()
    onRemove(peer.id)
  }

  // TODO: can't have nested tailwindcss groups, so need to do custom css for group-hover
  return (
    <ErrorBoundary>
      <Card className="Peer group max-w-sm flex-1 bg-white shadow-md relative">
        <RemoveButton onClick={remove}></RemoveButton>

        <CardBody className="Header flex items-center bg-teal-500">
          <Avatar size="lg" className="bg-opacity-75">
            {peer.user.emoji}
          </Avatar>

          <h1 className="text-white text-2xl font-extrabold flex-grow">{peer.user.name}</h1>

          <Avatar size="sm">{peer.device.emoji}</Avatar>
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

const isAlice = (peer: PeerInfo) => peer.user.name === 'Alice' && peer.device.name === 'laptop'
