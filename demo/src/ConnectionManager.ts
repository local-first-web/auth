import * as Auth from '@localfirst/auth'
import { type InviteeMemberContext, type MemberContext } from '@localfirst/auth'
import { Mutex, withTimeout } from 'async-mutex'
import debug from 'debug'
import { ConnectionStatus } from 'types.js'
import { EventEmitter } from './EventEmitter.js'
import { DemoConnection } from 'DemoConnection.js'
import { Client } from '@localfirst/relay/Client.js'
import WebSocket from 'isomorphic-ws'

// It shouldn't take longer than this to present an invitation and have it accepted. If this time
// expires, we'll try presenting the invitation to someone else.
const INVITATION_TIMEOUT = 20 * 1000 // in ms

/**
 * Wraps a Relay client and creates a Connection instance for each peer we connect to.
 */
export class ConnectionManager extends EventEmitter {
  private context: Auth.MemberContext | Auth.InviteeContext
  private readonly client: Client
  private connections: Record<string, DemoConnection> = {}
  private readonly connectingMutex = withTimeout(new Mutex(), INVITATION_TIMEOUT)

  /**
   * A dictionary of strings describing the connection status of each of our peers.
   * e.g.
   *    {alice: 'connected', bob: 'connecting', charlie: 'disconnected'}
   */
  public connectionStatus: Record<string, ConnectionStatus> = {}

  public teamName: string

  constructor({ teamName, urls, context }: ConnectionManagerOptions) {
    super()
    this.context = context
    this.teamName = teamName

    this.log = debug(`lf:auth:demo:connection-manager:${context.device.userId}`)

    this.client = this.connectServer(urls[0])
  }

  private connectServer(url: string): Client {
    const deviceId = this.context.device.deviceId
    const client = new Client({ peerId: deviceId, url })

    client
      .on('server-connect', () => {
        client.join(this.teamName)
        this.emit('server-connect')
      })
      .on('peer-connect', async ({ socket }) => {
        // in case we're not able to start the connection immediately (e.g. because there's a mutex
        // lock), store any messages we receive, so we can deliver them when we start it
        const storedMessages: Uint8Array[] = []
        socket.addEventListener('message', event => {
          const message = event.data as Uint8Array
          console.log('storing message', typeof message, message)
          storedMessages.push(message)
        })

        // We don't want to present invitations to multiple people simultaneously, because then they
        // both might admit us concurrently and that complicates things unnecessarily. So we need to
        // make sure that we go through the connection process with one other peer at a time.
        const iHaveInvitation = 'invitationSeed' in this.context && this.context.invitationSeed
        if (iHaveInvitation) {
          await this.connectingMutex.runExclusive(async () => {
            await this.connectPeer(socket, deviceId, storedMessages)
          })
        } else {
          this.log('connecting without mutex')
          this.connectPeer(socket, deviceId, storedMessages)
        }
      })
    return client
  }

  public disconnectServer() {
    const allPeers = Object.keys(this.connections)
    for (const p of allPeers) this.disconnectPeer(p)
    this.client.disconnectServer()
    this.connections = {}
    this.emit('server-disconnect')
  }

  private readonly connectPeer = async (
    socket: WebSocket,
    peerId: string,
    storedMessages: Uint8Array[]
  ) =>
    new Promise<void>((resolve, reject) => {
      this.log('connecting with context', this.context)
      // connect with a new peer
      const connection = new DemoConnection({
        socket,
        context: this.context,
        peerId,
        storedMessages,
      })
      connection
        .on('joined', ({ team, user }) => {
          // no longer an invitee - update our context for future connections
          const { device } = this.context as InviteeMemberContext
          this.context = { device, user, team } as MemberContext
          this.emit('joined', { team, user })
        })
        .on('connected', () => {
          this.emit('connected', connection)
          resolve()
        })
        .on('change', state => {
          this.updateStatus(peerId, state)
          this.emit('change', { peerId: peerId, state })
        })
        .on('localError', type => {
          this.emit('localError', type)
        })
        .on('remoteError', type => {
          this.emit('remoteError', type)
        })
        .on('disconnected', event => {
          this.disconnectPeer(peerId, event)
          resolve()
        })

      this.connections[peerId] = connection
    })

  private readonly disconnectPeer = (peerId: string, event?: any) => {
    // if we have this connection, disconnect it
    if (this.connections[peerId]) {
      this.connections[peerId].disconnect()
      delete this.connections[peerId]
    }

    // notify relay server
    this.client.disconnectPeer(peerId)

    // update our state object for the app's benefit
    this.updateStatus(peerId, 'disconnected')

    this.emit('disconnected', peerId, event)
  }

  private readonly updateStatus = (peerId: string, state: string) => {
    this.log('updating status', peerId, state)
    // we recreate the whole object so that react reacts
    this.connectionStatus = {
      ...this.connectionStatus,
      [peerId]: state,
    }
  }
}

type ConnectionManagerOptions = {
  teamName: string
  urls: string[]
  context: Auth.InviteeContext | Auth.MemberContext
}
