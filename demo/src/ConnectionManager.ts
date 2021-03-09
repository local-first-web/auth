import * as auth from '@localfirst/auth'
import { Client } from '@localfirst/relay-client'
import debug from 'debug'
import { WebSocketDuplex } from 'websocket-stream'
import { Connection } from './Connection'
import { EventEmitter } from './EventEmitter'

/**
 * Wraps a Relay client and creates a Connection instance for each peer we connect to.
 */
export class ConnectionManager extends EventEmitter {
  private context: auth.InitialContext

  private client: Client
  private connections: Record<string, Connection> = {}

  /** This is a map of userName -> state, where `state` is the state summary
   * from the auth.Connection machine, e.g. "connecting:authenticating". */
  public state: Record<string, string> = {}
  urls: string[]
  teamName: string

  constructor({ teamName, urls, context }: ConnectionManagerOptions) {
    super()
    this.log = debug(`lf:tc:connection-manager:${context.user!.userName}`)

    this.context = context
    this.urls = urls
    this.teamName = teamName

    // connect to relay server
    this.client = this.connectServer()
  }

  private connectServer(): Client {
    const client = new Client({ userName: this.context.user!.userName, url: this.urls[0] })
    // tell relay server we're interested in a specific team
    client
      .join(this.teamName)

      .on('close', () => {
        // disconnected from relay server
        this.disconnectServer()
      })

      .on('peer.connect', ({ userName, socket }) => {
        // connected to a new peer
        if (socket) this.connectPeer(userName, socket)
        else this.log('no socket')
      })
    return client
  }

  public async disconnectServer() {
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

    connection.on('change', connectionState => {
      this.state = {
        ...this.state,
        [userName]: connectionState,
      }
      this.emit('change')
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
