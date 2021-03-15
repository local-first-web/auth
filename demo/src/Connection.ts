import * as auth from '@localfirst/auth'
import debug from 'debug'
import { EventEmitter } from './EventEmitter'

export class Connection extends EventEmitter {
  authConnection: auth.Connection

  public log: debug.Debugger

  constructor(peerSocket: WebSocket, context: auth.InitialContext) {
    super()
    this.authConnection = this.connect(peerSocket, context)
    this.log = debug(`lf:tc:conn:${context.user?.userName || 'unknown'}`)
  }

  public connect(peerSocket: WebSocket, context: auth.InitialContext) {
    const sendMessage: auth.SendFunction = message => {
      peerSocket.send(JSON.stringify(message))
    }

    const authConnection = new auth.Connection({ context, sendMessage }).start()

    peerSocket.addEventListener('message', messageEvent => {
      const message = messageEvent.data
      authConnection.deliver(JSON.parse(message))
    })

    pipeEvents(authConnection, this, ['connected', 'joined', 'disconnected', 'change'])

    peerSocket.addEventListener('close', () => this.disconnect())

    return authConnection
  }

  public disconnect() {
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
