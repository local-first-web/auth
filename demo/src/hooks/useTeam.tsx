import * as auth from '@localfirst/auth'
import cuid from 'cuid'
import * as React from 'react'
import { teamContext } from '../components/TeamProvider'
import { ConnectionManager } from '../ConnectionManager'
import { AlertInfo, PeerState } from '../types'
import { assert } from '../util/assert'
import { randomTeamName } from '../util/randomTeamName'

// TODO: make this an environment var
const relayUrls = ['ws://localhost:8080']

export const useTeam = () => {
  const context = React.useContext(teamContext)
  assert(context, `useTeam must be used within a TeamProvider`)

  const [peerState, setPeerState] = context
  const { userName, user, team, device } = peerState
  const head = team?.chain?.head

  React.useEffect(() => {
    if (team) {
      const updateTeamState = () => setPeerState(prev => ({ ...prev, state: team.state }))
      team.addListener('updated', updateTeamState)
      return () => {
        team.removeListener('updated', updateTeamState)
      }
    }
  }, [team])

  React.useEffect(() => {
    // clear the team if the user is no longer a member
    if (user && team && !team.has(user.userName)) {
      setPeerState(prev => {
        const { team, ...stateMinusTeam } = prev
        return stateMinusTeam
      })
    }
  }, [head])

  const addAlert = (message: string, type: AlertInfo['type'] = 'info') => {
    setPeerState(prev => {
      const alert = { id: cuid(), message, type }
      return {
        ...prev,
        alerts: prev.alerts.concat(alert),
      }
    })
  }

  const clearAlert = (id: string) => {
    setPeerState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(alert => alert.id !== id),
    }))
  }

  const setTeam = (newTeam: auth.Team) => {
    setPeerState(prev => {
      return {
        ...prev,
        team: newTeam,
        teamState: newTeam.state,
      }
    })
  }

  const createTeam = () => {
    assert(user)
    const team = auth.createTeam(randomTeamName(), { user, device })
    setPeerState((prev: PeerState) => {
      return {
        ...prev,
        team,
        teamState: team.state,
      }
    })

    const { teamName } = team
    const context = { userName, user, device, team }
    connect(teamName, context)
  }

  const joinTeam = (teamName: string, invitationSeed: string) => {
    const context = { userName, user, device, invitationSeed }
    connect(teamName, context)
  }

  const connect = (teamName: string, context: auth.InitialContext) => {
    const connectionManager = new ConnectionManager({ teamName, urls: relayUrls, context })
      .on('server.connect', () => {
        setPeerState(prev => ({
          ...prev,
          online: true,
          connectionStatus: connectionManager.connectionStatus,
        }))
      })
      .on('server.disconnect', () => {
        setPeerState(prev => ({
          ...prev,
          online: false,
          connectionStatus: {},
        }))
      })
      .on('joined', ({ team, user }) => {
        setPeerState(prev => ({
          ...prev,
          team,
          user,
        }))
      })
      .on('change', () => {
        setPeerState((prev: PeerState) => ({
          ...prev,
          connectionStatus: connectionManager.connectionStatus,
        }))
      })
      .on('connected', (connection: auth.Connection) => {
        // get the latest team info from the connection
        setTeam(connection.team!)
      })
      .on('disconnected', (_id, event) => {
        if (event?.type === 'ERROR') addAlert(event.payload.message)
        setPeerState((prev: PeerState) => ({
          ...prev,
          connectionStatus: connectionManager.connectionStatus,
        }))
      }) as ConnectionManager

    setPeerState(prev => ({
      ...prev,
      connectionManager,
    }))
  }

  const disconnect = () => {
    if (!peerState.connectionManager) return
    peerState.connectionManager.disconnectServer()
  }

  return { ...peerState, addAlert, clearAlert, createTeam, joinTeam, connect, disconnect }
}
