import { EventEmitter } from '@herbcaudill/eventemitter42'
import * as Auth from '@localfirst/auth'
import { ConnectionEvents } from '@localfirst/auth'
import { bubbleEvents } from 'bubbleEvents.js'
import WebSocket from 'isomorphic-ws'

export class DemoConnection extends EventEmitter<ConnectionEvents> {
  private readonly authConnection: Auth.Connection
  private readonly peerSocket: WebSocket

  constructor({ socket, context, peerId, storedMessages }: ConnectionParams) {
    super()
    this.peerSocket = socket

    // pass outgoing messages from the auth connection to the socket

    this.authConnection = new Auth.Connection({
      context,
      sendMessage: message => {
        socket.send(message)
      },
    })

    // listen for incoming messages and pass them to the auth connection
    socket.addEventListener('message', ({ data }) => {
      this.authConnection.deliver(data as Uint8Array)
    })

    // if the remote peer closes the connection, close up here as well
    socket.addEventListener('close', () => {
      this.disconnect()
    })

    // bubble up events from the auth connection
    bubbleEvents(this.authConnection, this, [
      'connected',
      'joined',
      'disconnected',
      'change',
      'remoteError',
      'localError',
    ])

    // start the connection with any stored messages
    this.authConnection.start()
  }

  public disconnect() {
    this.peerSocket.close()
    this.authConnection.stop()
  }

  get team() {
    return this.authConnection.team
  }

  get state() {
    return this.authConnection.state as Auth.ConnectionState
  }
}

type ConnectionParams = {
  socket: WebSocket
  context: Auth.Context
  peerId: string
  storedMessages?: Uint8Array[]
}
