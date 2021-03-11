import * as React from 'react'
import { Team, User, DeviceWithSecrets, user } from '@localfirst/auth'
import { AlertInfo } from './Alerts'
import { ConnectionManager } from 'ConnectionManager'
import cuid from 'cuid'
import { randomTeamName } from 'util/randomTeamName'
import * as auth from '@localfirst/auth'
import { PeerInfo } from 'peers'

const peerStateContext = React.createContext<PeerStateContextPayload>(undefined)

export const usePeerState = () => {
  const context = React.useContext(peerStateContext)
  if (context === undefined) throw new Error(`usePeerState must be used within a PeerStateProvider`)

  const [peerState, setPeerState] = context

  // const addAlert = (message: string, type: AlertInfo['type'] = 'info') => {
  //   const alert = { id: cuid(), message, type }
  //   setAlerts(alerts => [...alerts, alert])
  // }

  // const clearAlert = (id: string) => {
  //   setAlerts(alerts => alerts.filter(alert => alert.id !== id))
  // }

  // const createTeam = () => {
  //   // log('creating team')
  //   const team = auth.createTeam(randomTeamName(), { user, device })

  //   setTeam(team)

  //   const { teamName } = team
  //   const context = { user, device, team }
  //   connect(teamName, context)
  // }

  // const joinTeam = (teamName: string, invitationSeed: string) => {
  //   // log('joining team')
  //   const context = {
  //     user,
  //     device,
  //     invitee: { type: 'MEMBER', name: user.userName } as auth.Invitee,
  //     invitationSeed,
  //   }
  //   connect(teamName, context)
  // }

  // const connect = (teamName: string, context: auth.InitialContext) => {
  //   const connectionManager = new ConnectionManager({ teamName, urls, context })
  //     .on('change', () => {
  //       return setConnections(connectionManager.state)
  //     })
  //     .on('connected', (connection: auth.Connection) => {
  //       // get the latest team info from the connection
  //       setTeam(connection.team!)
  //     })
  //     .on('disconnected', (_id, event) => {
  //       if (event?.type === 'ERROR') addAlert(event.payload.message)
  //       setConnections(connectionManager.state)
  //     }) as ConnectionManager
  //   setConnectionManager(connectionManager)
  // }

  // const remove = async () => {
  //   await connectionManager?.disconnectServer()
  //   onRemove(peer.id)
  // }

  return { peerState, setPeerState }
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
