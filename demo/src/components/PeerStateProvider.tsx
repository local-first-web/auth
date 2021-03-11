import * as auth from '@localfirst/auth'
import { DeviceWithSecrets, Team, User } from '@localfirst/auth'
import cuid from 'cuid'
import * as React from 'react'
import { randomTeamName } from '../util/randomTeamName'
import { ConnectionManager } from '../ConnectionManager'
import { PeerInfo } from '../peers'
import { AlertInfo } from './Alerts'

// TODO: make this an environment var
const urls = ['ws://localhost:8080']

const peerStateContext = React.createContext<PeerStateContextPayload>(undefined)

export const usePeerState = () => {
  const context = React.useContext(peerStateContext)
  if (context === undefined) throw new Error(`usePeerState must be used within a PeerStateProvider`)

  const [peerState, setPeerState] = context
  const { user, device, team } = peerState

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
        // peer.team = team
        return { ...prevPeerState, team }
      }
    })
  }

  const createTeam = () => {
    // log('creating team')
    const team = auth.createTeam(randomTeamName(), { user, device })

    setTeam(team)

    const { teamName } = team
    const context = { user, device, team }
    connect(teamName, context)
  }

  const joinTeam = (teamName: string, invitationSeed: string) => {
    // log('joining team')
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

  return { peerState, setPeerState, addAlert, clearAlert, createTeam, joinTeam, connect }
}

export const PeerStateProvider: React.FC<{ peer: PeerInfo }> = props => {
  const { peer, ...otherProps } = props

  const initialValue: PeerState = {
    user: auth.createUser(peer.user.name),
    device: auth.createDevice(peer.user.name, peer.device.name),
    alerts: [],
  }

  const [peerState, setPeerState] = React.useState(initialValue)

  const contextValue = React.useMemo(() => {
    return [peerState, setPeerState] as PeerStateContextPayload
  }, [peerState])

  return <peerStateContext.Provider {...otherProps} value={contextValue} />
}

type PeerStateContextPayload =
  | [PeerState, React.Dispatch<React.SetStateAction<PeerState>>]
  | undefined

export type PeerState = {
  user: User
  device: DeviceWithSecrets
  team?: Team
  connectionManager?: ConnectionManager
  connectionStatus?: Record<UserName, ConnectionStatus>
  alerts: AlertInfo[]
}

export type UserName = string
export type ConnectionStatus = string
