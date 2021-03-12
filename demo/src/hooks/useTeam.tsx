import * as auth from '@localfirst/auth'
import { DeviceWithSecrets, Team, User } from '@localfirst/auth'
import debug from 'debug'
import cuid from 'cuid'
import * as React from 'react'
import { randomTeamName } from '../util/randomTeamName'
import { ConnectionManager } from '../ConnectionManager'
import { AlertInfo } from '../components/Alerts'
import { assert } from '../util/assert'
import { teamContext } from '../components/TeamProvider'
import { UserName, ConnectionStatus } from '../types'

// TODO: make this an environment var
const urls = ['ws://localhost:8080']

export const useTeam = () => {
  const context = React.useContext(teamContext)
  assert(context, `useTeam must be used within a TeamProvider`)

  const [peerState, setPeerState] = context
  const { user, device } = peerState

  const log = debug(`lf:tc:peer:${user.userName}`)

  const addAlert = (message: string, type: AlertInfo['type'] = 'info') => {
    setPeerState(prevPeerState => {
      const alert = { id: cuid(), message, type }
      return {
        ...prevPeerState,
        alerts: prevPeerState.alerts.concat(alert),
      }
    })
  }

  const clearAlert = (id: string) => {
    setPeerState(prevPeerState => {
      return {
        ...prevPeerState,
        alerts: prevPeerState.alerts.filter(alert => alert.id !== id),
      }
    })
  }

  const setTeam = (newTeam: auth.Team) => {
    setPeerState((prevPeerState: PeerState) => {
      const oldTeam = prevPeerState.team
      if (!oldTeam) {
        return { ...prevPeerState, team: newTeam }
      } else {
        const team = oldTeam.merge(newTeam.chain)
        return { ...prevPeerState, team }
      }
    })
  }

  const createTeam = () => {
    log('creating team')
    const team = auth.createTeam(randomTeamName(), { user, device })

    setPeerState((prevPeerState: PeerState) => {
      return {
        ...prevPeerState,
        team,
      }
    })

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
        setPeerState((prevPeerState: PeerState) => ({
          ...prevPeerState,
          connectionStatus: connectionManager.state,
        }))
      })
      .on('connected', (connection: auth.Connection) => {
        // get the latest team info from the connection
        setTeam(connection.team!)
      })
      .on('disconnected', (_id, event) => {
        if (event?.type === 'ERROR') addAlert(event.payload.message)
        setPeerState((prevPeerState: PeerState) => ({
          ...prevPeerState,
          connectionStatus: connectionManager.state,
        }))
      }) as ConnectionManager
    peerState.connectionManager = connectionManager
  }

  return { ...peerState, addAlert, clearAlert, createTeam, joinTeam, connect }
}

export type PeerState = {
  user: User
  device: DeviceWithSecrets
  team?: Team
  connectionManager?: ConnectionManager
  connectionStatus: Record<UserName, ConnectionStatus>
  alerts: AlertInfo[]
}
