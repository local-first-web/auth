import { Card, CardBody } from '@windmill/react-ui'
import { PeerInfo } from '../peers'
import { Alerts } from './Alerts'
import { Avatar } from './Avatar'
import { CreateOrJoinTeam } from './CreateOrJoinTeam'
import { ErrorBoundary } from './ErrorBoundary'
import { useTeam } from '../hooks/useTeam'
import { RemoveButton } from './RemoveButton'
import { Team } from './Team'
import * as React from 'react'

const AUTO_CREATE_ALICE_TEAM = true

export const Peer = ({ peerInfo, onRemove }: PeerProps) => {
  const { team, createTeam, connectionManager } = useTeam()

  React.useEffect(() => {
    // set up Alice on first load
    if (!team && AUTO_CREATE_ALICE_TEAM && peerInfo.id === 'Alice:laptop') {
      createTeam()
    }
  }, [peerInfo.id])

  const remove = async () => {
    await connectionManager?.disconnectRelayServer()
    onRemove(peerInfo.id)
  }

  return (
    <ErrorBoundary>
      {/* TODO: can't have nested tailwindcss groups, so need to do custom css for group-hover */}

      <Card className="Peer group max-w-sm flex-1 bg-white shadow-md relative">
        <RemoveButton onClick={remove}></RemoveButton>
        <CardBody className="Header flex items-center bg-teal-500">
          <Avatar size="lg" className="bg-opacity-75" children={peerInfo.user.emoji} />
          <h1
            className="text-white text-2xl font-extrabold flex-grow"
            children={peerInfo.user.name}
          />
          <Avatar size="sm" children={peerInfo.device.emoji} />
        </CardBody>
        <Alerts />
        {!team ? (
          // Not on a team; show Create team / Join team buttons
          <CreateOrJoinTeam />
        ) : (
          // Team members, sig chain, etc.
          <Team />
        )}
      </Card>
    </ErrorBoundary>
  )
}

interface PeerProps {
  peerInfo: PeerInfo
  onRemove: (id: string) => void
}
