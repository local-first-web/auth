import * as auth from '@localfirst/auth'
import { Client } from '@localfirst/relay-client'
import debug from 'debug'
import { ConnectionStatus, UserName } from './types'
import { Connection } from './Connection'
import { EventEmitter } from './EventEmitter'
import { MemberInitialContext } from '@localfirst/auth'

/**
 * Wraps a Relay client and creates a Connection instance for each peer we connect to.
 */
export class ConnectionManager extends EventEmitter {
  private context: auth.InitialContext

  private client: Client
  private connections: Record<UserName, Connection> = {}
  public connectionStatus: Record<UserName, ConnectionStatus> = {}
  teamName: string

  constructor({ teamName, urls, context }: ConnectionManagerOptions) {
    super()
    this.log = debug(`lf:tc:connection-manager:${context.user!.userName}`)

    this.context = context
    this.teamName = teamName

    // connect to relay server
    this.client = this.connectServer(urls[0])
  }

  private connectServer(url: string): Client {
    const { userName } = this.context.user! // we always provide a user whether we're invited or a member
    const client = new Client({ userName, url })

    client.on('server.connect', () => {
      client.join(this.teamName)
      this.emit('server.connect')
    })
    client.on('peer.connect', ({ userName, socket }) => this.connectPeer(userName, socket))
    client.on('close', () => this.disconnectServer())

    return client
  }

  public disconnectServer() {
    const allPeers = Object.keys(this.connections)
    allPeers.forEach(p => this.disconnectPeer(p))
    this.client.disconnectServer()
    this.connections = {}
    this.emit('server.disconnect')
  }

  public connectPeer = (userName: string, socket: WebSocket) => {
    // connected to a new peer
    const connection = new Connection(socket, this.context)
    this.connections[userName] = connection

    connection
      .on('change', state => {
        this.updateStatus(userName, state)
        this.emit('change', state)
      })
      .on('joined', team => {
        const context = this.context as MemberInitialContext
        context.team = team
        this.emit('joined', team)
      })
      .on('connected', () => this.emit('connected', connection))
      .on('disconnected', event => this.disconnectPeer(userName, event))
  }

  public disconnectPeer = (userName: string, event?: any) => {
    // if we have this connection, disconnect it
    if (this.connections[userName]) {
      this.connections[userName].disconnect()
      delete this.connections[userName]
    }

    // notify relay server
    this.client.disconnectPeer(userName)

    // update our state object for the app's benefit
    this.updateStatus(userName, 'disconnected')

    this.emit('disconnected', userName, event)
  }

  public get connectionCount() {
    return Object.keys(this.connections).length
  }

  private updateStatus = (userName: UserName, state: string) => {
    // we recreate the whole object so that react reacts
    this.connectionStatus = {
      ...this.connectionStatus,
      [userName]: state,
    }
  }
}

interface ConnectionManagerOptions {
  teamName: string
  urls: string[]
  context: auth.InitialContext
}
