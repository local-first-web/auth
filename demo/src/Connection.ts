import * as auth from '@localfirst/auth'
import debug from 'debug'
import { EventEmitter } from './EventEmitter'
import { Duplex } from 'stream'
import { WebSocketDuplex } from 'websocket-stream'

const NOOP = () => {}

export class Connection extends EventEmitter {
  authConnection: auth.Connection
  stream = new Duplex({ write: NOOP, read: NOOP })

  public log: debug.Debugger

  constructor(peerSocket: WebSocketDuplex, context: auth.InitialContext) {
    super()
    this.authConnection = this.connect(peerSocket, context)
    this.log = debug(`lf:tc:conn:${context.user?.userName || 'unknown'}`)
  }

  public connect(peerSocket: WebSocketDuplex, context: auth.InitialContext) {
    const authConnection = new auth.Connection({ context }).start()

    // this ⇆ authConnection ⇆ peerSocket
    authConnection.stream.pipe(peerSocket).pipe(authConnection.stream)
    this.stream.pipe(authConnection.stream).pipe(this.stream)

    pipeEvents(authConnection, this, ['connected', 'joined', 'disconnected', 'change'])

    peerSocket.on('close', () => this.disconnect())

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
