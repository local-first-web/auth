import * as auth from '@localfirst/auth'
import { Client } from '@localfirst/relay-client'
import debug from 'debug'
import { ConnectionStatus, UserName } from './types'
import { WebSocketDuplex } from 'websocket-stream'
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
  public state: Record<UserName, ConnectionStatus> = {}
  urls: string[]
  teamName: string

  constructor({ teamName, urls, context }: ConnectionManagerOptions) {
    super()
    this.log = debug(`lf:tc:connection-manager:${context.user!.userName}`)

    this.context = context
    this.urls = urls
    this.teamName = teamName

    // connect to relay server
    this.client = this.connectRelayServer()
  }

  private connectRelayServer(): Client {
    const client = new Client({ userName: this.context.user!.userName, url: this.urls[0] })
    // tell relay server we're interested in a specific team
    client
      .join(this.teamName)

      .on('close', () => {
        // disconnected from relay server
        this.disconnectRelayServer()
      })

      .on('peer.connect', ({ userName, socket }) => {
        // connected to a new peer
        if (socket) this.connectPeer(userName, socket)
        else this.log('no socket')
      })
    return client
  }

  public async disconnectRelayServer() {
    const closeAllConnections = Object.keys(this.connections).map(peerId =>
      this.disconnectPeer(peerId)
    )
    await Promise.all(closeAllConnections)
    this.connections = {}
    this.emit('close')
  }

  private connectPeer(userName: string, socket: WebSocketDuplex) {
    this.log('peer.connect', userName)
    const connection = new Connection(socket, this.context)
    this.connections[userName] = connection

    connection
      .on('change', connectionState => {
        this.state = {
          ...this.state,
          [userName]: connectionState,
        }
        this.emit('change')
      })
      .on('joined', team => {
        this.log('joined team', team.teamName)
        const context = this.context as MemberInitialContext
        context.team = team
      })

    connection.on('connected', () => this.emit('connected', connection))
    connection.on('disconnected', event => this.disconnectPeer(userName, event))
  }

  public disconnectPeer = (userName: string, event?: any) => {
    // if we have this connection, disconnect it
    if (this.connections[userName]) {
      this.connections[userName].disconnect()
      delete this.connections[userName]
    }

    // update our state object
    this.state = {
      ...this.state,
      [userName]: 'disconnected',
    }

    // notify relay server
    this.client.disconnect(userName)

    this.emit('disconnected', userName, event)
  }

  public get connectionCount() {
    return Object.keys(this.connections).length
  }
}

interface ConnectionManagerOptions {
  teamName: string
  urls: string[]
  context: auth.InitialContext
}
