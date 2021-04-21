import * as auth from '@localfirst/auth'
import { Client } from '@localfirst/relay-client'
import debug from 'debug'
import { ConnectionStatus, UserName } from './types'
import { Connection } from './Connection'
import { EventEmitter } from './EventEmitter'
import { InviteeInitialContext, MemberInitialContext } from '@localfirst/auth'
import { Mutex, withTimeout, E_CANCELED as CANCELED } from 'async-mutex'

// It shouldn't take longer than this to present an invitation and have it accepted. If this time
// expires, we'll try presenting the invitation to someone else.
const INVITATION_TIMEOUT = 10 * 1000 // in ms

/**
 * Wraps a Relay client and creates a Connection instance for each peer we connect to.
 */
export class ConnectionManager extends EventEmitter {
  private context: auth.InitialContext
  private client: Client
  private connections: Record<UserName, Connection> = {}
  private invitationMutex = withTimeout(new Mutex(), INVITATION_TIMEOUT)

  public connectionStatus: Record<UserName, ConnectionStatus> = {}
  public teamName: string

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

  public connectPeer = async (userName: string, socket: WebSocket) => {
    this.log('connect.peer', userName)

    const connect = async () =>
      new Promise<void>((resolve, reject) => {
        this.log(
          `**** instantiating connection to ${userName} ... (${
            this.isMember ? 'member' : 'not member'
          })`
        )

        // connect with a new peer
        const connection = new Connection(socket, this.context, userName)
        this.connections[userName] = connection
        connection
          .on('joined', team => {
            this.log(`**** joined via ${userName}`)
            // no longer an invitee - update our context for any future connections
            const { device, user } = this.context as InviteeInitialContext
            this.context = { device, user, team } as MemberInitialContext
            this.emit('joined', team)
          })
          .on('connected', () => {
            this.log(`**** connected to ${userName}`)
            resolve()
            this.emit('connected', connection)
          })
          .on('change', state => {
            this.updateStatus(userName, state)
            this.emit('change', { userName, state })
          })
          .on('disconnected', event => {
            this.disconnectPeer(userName, event)
            reject()
          })
      })

    if (!this.isMember)
      // We don't want to present invitations to multiple people simultaneously, because then they
      // both might admit us concurrently and we don't know how to merge concurrent ADMITs
      // gracefully. So if we have an invitation we need to make sure that we only present it to one
      // person at a time.
      try {
        this.log(`**** connecting to ${userName} with mutex (with invitation)`)
        await this.invitationMutex.runExclusive(connect)
        this.log(`**** ${userName} mutex released`)
      } catch (err) {
        if (err === CANCELED) console.error(err)
        else throw err
      }
    // If we're already a member, we don't need to put on a lock - we can connect with multiple
    // peers simultaneously
    else {
      this.log(`**** connecting to ${userName} without mutex`)
      connect()
    }
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

  private get isMember() {
    return 'team' in this.context && this.context.team !== undefined
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
