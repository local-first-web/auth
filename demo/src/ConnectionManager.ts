import * as auth from '@localfirst/auth'
import { InviteeMemberInitialContext, MemberInitialContext } from '@localfirst/auth'
import { Client, PeerEventPayload } from '@localfirst/relay-client'
import { Mutex, withTimeout } from 'async-mutex'
import debug from 'debug'
import { Connection } from './Connection'
import { EventEmitter } from './EventEmitter'
import { ConnectionStatus, UserName } from './types'

// It shouldn't take longer than this to present an invitation and have it accepted. If this time
// expires, we'll try presenting the invitation to someone else.
const INVITATION_TIMEOUT = 20 * 1000 // in ms

/**
 * Wraps a Relay client and creates a Connection instance for each peer we connect to.
 */
export class ConnectionManager extends EventEmitter {
  private context: auth.InitialContext
  private client: Client
  private connections: Record<UserName, Connection> = {}
  private connectingMutex = withTimeout(new Mutex(), INVITATION_TIMEOUT)

  /**
   * A dictionary of strings describing the connection status of each of our peers.
   * e.g.
   *    {alice: 'connected', bob: 'connecting', charlie: 'disconnected'}
   */
  public connectionStatus: Record<UserName, ConnectionStatus> = {}

  public teamName: string

  constructor({ teamName, urls, context }: ConnectionManagerOptions) {
    super()
    this.context = context
    this.teamName = teamName

    this.log = debug(`lf:auth:demo:connection-manager:${context.device.userId}`)

    this.client = this.connectServer(urls[0])
  }

  private connectServer(url: string): Client {
    const deviceId = auth.device.getDeviceId(this.context.device)
    const client = new Client({ userName: deviceId, url })

    client
      .on('server.connect', () => {
        client.join(this.teamName)
        this.emit('server.connect')
      })
      .on('peer.connect', async ({ userName: peerUserName, socket }: PeerEventPayload) => {
        // in case we're not able to start the connection immediately (e.g. because there's a mutex
        // lock), store any messages we receive, so we can deliver them when we start it
        const storedMessages: string[] = []
        socket.addEventListener('message', ({ data: message }) => {
          storedMessages.push(message)
        })

        // We don't want to present invitations to multiple people simultaneously, because then they
        // both might admit us concurrently and that complicates things unnecessarily. So we need to
        // make sure that we go through the connection process with one other peer at a time.
        const iHaveInvitation = 'invitationSeed' in this.context && this.context.invitationSeed
        if (iHaveInvitation) {
          await this.connectingMutex.runExclusive(async () => {
            await this.connectPeer(socket, peerUserName, storedMessages)
          })
        } else {
          this.log('connecting without mutex')
          this.connectPeer(socket, peerUserName, storedMessages)
        }
      })
    return client
  }

  public disconnectServer() {
    const allPeers = Object.keys(this.connections)
    allPeers.forEach(p => this.disconnectPeer(p))
    this.client.disconnectServer()
    this.connections = {}
    this.emit('server.disconnect')
  }

  private connectPeer = async (socket: WebSocket, peerUserName: string, storedMessages: string[]) =>
    new Promise<void>((resolve, reject) => {
      this.log('connecting with context', this.context)
      // connect with a new peer
      const connection = new Connection({
        socket,
        context: this.context,
        peerUserName,
        storedMessages,
      })
      connection
        .on('joined', ({ team, user }) => {
          // no longer an invitee - update our context for future connections
          const { device } = this.context as InviteeMemberInitialContext
          this.context = { device, user, team } as MemberInitialContext
          this.emit('joined', { team, user })
        })
        .on('connected', () => {
          this.emit('connected', connection)
          resolve()
        })
        .on('change', state => {
          this.updateStatus(peerUserName, state)
          this.emit('change', { userName: peerUserName, state })
        })
        .on('localError', type => {
          this.emit('localError', type)
        })
        .on('remoteError', type => {
          this.emit('remoteError', type)
        })
        .on('disconnected', event => {
          this.disconnectPeer(peerUserName, event)
          resolve()
        })

      this.connections[peerUserName] = connection
    })

  private disconnectPeer = (userName: string, event?: any) => {
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

  private updateStatus = (userName: UserName, state: string) => {
    this.log('updating status', userName, state)
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
