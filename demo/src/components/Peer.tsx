import * as auth from '@localfirst/auth'
import { Card, CardBody } from '@windmill/react-ui'
import cuid from 'cuid'
import debug from 'debug'
import React, { useEffect, useState } from 'react'
import { ConnectionManager } from '../ConnectionManager'
import { PeerInfo } from '../peers'
import { randomTeamName } from '../util/randomTeamName'
import { AlertInfo, Alerts } from './Alerts'
import { Avatar } from './Avatar'
import { CreateOrJoinTeam } from './CreateOrJoinTeam'
import { Team } from './Team'
import { ErrorBoundary } from './ErrorBoundary'
import { RemoveButton } from './RemoveButton'
import { TeamProvider, useTeam } from './TeamContext'

// TODO: make this an environment var
const urls = ['ws://localhost:8080']

export const Peer = ({ peer, onRemove }: PeerProps) => {
  const [user] = useState(() => auth.createUser(peer.user.name))
  const [device] = useState(() => auth.createDevice(peer.user.name, peer.device.name))

  const log = debug(`lf:tc:peer:${user.userName}`)

  const { team, setTeam: _setTeam } = useTeam()

  const [alerts, setAlerts] = useState([] as AlertInfo[])
  const [connections, setConnections] = useState<Record<string, string>>({})
  const [connectionManager, setConnectionManager] = useState<ConnectionManager>()

  useEffect(() => {
    if (peer.team) {
      log('reconnecting to', peer.team.teamName)
      setTeam(peer.team)
      const context = { user, device, team: peer.team }
      connect(peer.team.teamName, context)
    } else {
      // set up Alice on first load
      const AUTO_CREATE_ALICE_TEAM = true
      if (AUTO_CREATE_ALICE_TEAM && isAlice(peer)) createTeam()
    }
  }, [peer])

  const setTeam = (newTeam: auth.Team) => {
    _setTeam((oldTeam?: auth.Team) => {
      if (!oldTeam) return newTeam
      const team = oldTeam.merge(newTeam.chain)
      peer.team = team
      return team
    })
  }

  const addAlert = (message: string, type: AlertInfo['type'] = 'info') => {
    const alert = { id: cuid(), message, type }
    setAlerts(alerts => [...alerts, alert])
  }

  const clearAlert = (id: string) => {
    setAlerts(alerts => alerts.filter(alert => alert.id !== id))
  }

  const createTeam = () => {
    log('creating team')
    const team = auth.createTeam(randomTeamName(), { user, device })

    setTeam(team)

    const { teamName } = team
    const context = { user, device, team }
    connect(teamName, context)
  }

  const joinTeam = (teamName: string, invitationSeed: string) => {
    log('joining team')
    const context = {
      user,
      device,
      invitee: { type: 'MEMBER', name: user.userName } as auth.Invitee,
      invitationSeed,
    }
    connect(teamName, context)
  }

  const connect = (teamName: string, context: auth.InitialContext) => {
    const connectionManager = new ConnectionManager({ teamName, urls, context })
      .on('change', () => {
        return setConnections(connectionManager.state)
      })
      .on('connected', (connection: auth.Connection) => {
        // get the latest team info from the connection
        setTeam(connection.team!)
      })
      .on('disconnected', (_id, event) => {
        if (event?.type === 'ERROR') addAlert(event.payload.message)
        setConnections(connectionManager.state)
      }) as ConnectionManager
    setConnectionManager(connectionManager)
  }

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

        <Alerts alerts={alerts} clearAlert={clearAlert} />

        {team ? (
          <Team user={user} device={peer.device} team={team} connections={connections} />
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
