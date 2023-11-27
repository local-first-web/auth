import * as auth from '@localfirst/auth'
import EventEmitter from 'eventemitter3'

export class Connection extends EventEmitter {
  private readonly authConnection: auth.Connection
  private readonly peerSocket: WebSocket

  constructor({ socket, context, peerUserName: peerUserId, storedMessages }: ConnectionParams) {
    super()
    this.peerSocket = socket

    // pass outgoing messages from the auth connection to the socket
    const sendMessage: auth.SendFunction = message => {
      // TODO probably the relay client should take care of this (checking if socket is ready, queuing
      // messages if not, etc.)
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message)
      }
    }

    this.authConnection = new auth.Connection({
      context,
      sendMessage,
    })

    // listen for incoming messages and pass them to the auth connection
    socket.addEventListener('message', ({ data: message }) => {
      this.authConnection.deliver(message)
    })

    // if the remote peer closes the connection, close up here as well
    socket.addEventListener('close', () => this.disconnect())

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
    this.authConnection.start(storedMessages)
  }

  public disconnect() {
    this.peerSocket.close()
    this.authConnection.stop()
  }

  get team() {
    return this.authConnection.team
  }

  get state() {
    return this.authConnection.state
  }
}

const bubbleEvents = (source: EventEmitter<any>, target: EventEmitter<any>, events: string[]) => {
  for (const event of events) source.on(event, payload => target.emit(event, payload))
}

type ConnectionParams = {
  socket: WebSocket
  context: auth.Context
  peerUserName: string
  storedMessages?: string[]
}
