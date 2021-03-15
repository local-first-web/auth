import * as auth from '@localfirst/auth'
import { EventEmitter } from './EventEmitter'

export class Connection extends EventEmitter {
  private authConnection: auth.Connection
  private peerSocket: WebSocket

  constructor(peerSocket: WebSocket, context: auth.InitialContext) {
    super()
    this.peerSocket = peerSocket

    const sendMessage: auth.SendFunction = message => peerSocket.send(JSON.stringify(message))
    this.authConnection = new auth.Connection({ context, sendMessage }).start()

    // listen for incoming messages and pass them to the auth connection
    peerSocket.addEventListener('message', messageEvent => {
      const message = messageEvent.data
      this.authConnection.deliver(JSON.parse(message))
    })

    // if the remote peer closes the connection, close up here as well
    peerSocket.addEventListener('close', () => this.disconnect())

    pipeEvents(this.authConnection, this, ['connected', 'joined', 'disconnected', 'change'])
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

const pipeEvents = (source: EventEmitter, target: EventEmitter, events: string[]) =>
  events.forEach(event => source.on(event, payload => target.emit(event, payload)))
