import { EventEmitter } from 'events'
import { Transform } from 'stream'
import { Protocol } from './Protocol'
import { InitialContext } from '/connection/types'
import { debug } from '/util'

export class Connection extends Transform {
  private connection: Protocol
  userName: string

  constructor(context: InitialContext) {
    super()
    this.userName = context.user.userName
    this.log('new connectionStream')
    this.connection = new Protocol({
      context,
      sendMessage: (message) => this.push(JSON.stringify(message)),
    })
    pipeEvents(this.connection, this, ['connected', 'joined', 'updated', 'disconnected'])
    // this.on('data', (data) => this.log('outgoing: %o', data.toString()))
  }

  private get log() {
    return debug(`lf:auth:connection:${this.userName}`)
  }

  public start() {
    this.log('stream: starting')
    this.connection.start()
    return this
  }

  public stop() {
    this.connection.stop()
    return this
  }

  // incoming messages
  public _transform(chunk: any, encoding?: BufferEncoding | Callback, next?: Callback): boolean {
    const message = JSON.parse(chunk.toString())
    // this.log('incoming: %o', message)
    try {
      this.connection.deliver(message)
    } catch (err) {
      if (next) next(err)
      return false
    }
    if (next) next(null)
    return true
  }

  public get state() {
    return this.connection.state
  }

  public get team() {
    return this.connection.team
  }

  public get sessionKey() {
    return this.connection.sessionKey
  }
  public get error() {
    return this.connection.error
  }
}

const pipeEvents = (source: EventEmitter, target: EventEmitter, events: string[]) =>
  events.forEach((event) => source.on(event, (payload) => target.emit(event, payload)))

export type Callback = (error: Error | null | undefined) => void
