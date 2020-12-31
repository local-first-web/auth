import { EventEmitter } from 'events'
import { Transform } from 'stream'
import { Protocol } from './Protocol'
import { InitialContext } from '/connection/types'

// This is a thin wrapper around a Protocol instance that gives it a transform (duplex) stream API.
// Beyond that, the only work it does is to serialize the message on the way out, and deserialize it
// on the way in.

export class Connection extends Transform {
  private protocol: Protocol
  userName: string

  constructor(context: InitialContext) {
    super()

    // outgoing messages are stringified and pushed into the stream
    const sendMessage = (message: any) => this.push(JSON.stringify(message))

    this.protocol = new Protocol({ context, sendMessage })

    // pass events from protocol
    pipeEvents(this.protocol, this, ['connected', 'joined', 'updated', 'disconnected'])
  }

  // Transform stream implementation
  public _transform(chunk: any, _?: BufferEncoding | Callback, next?: Callback) {
    if (typeof _ === 'function') next = _

    try {
      // incoming messages are parsed and delivered to the protocol
      const message = JSON.parse(chunk.toString())
      this.protocol.deliver(message)
    } catch (err) {
      // callback with error
      if (next) next(err)
    }

    // callback with no error
    if (next) next(null)
  }

  // ------- passthrough to protocol

  public start() {
    this.protocol.start()
    return this
  }

  public stop() {
    this.protocol.stop()
    return this
  }

  public get state() {
    return this.protocol.state
  }

  public get team() {
    return this.protocol.team
  }

  public get sessionKey() {
    return this.protocol.sessionKey
  }

  public get error() {
    return this.protocol.error
  }
}

const pipeEvents = (source: EventEmitter, target: EventEmitter, events: string[]) =>
  events.forEach((event) => source.on(event, (payload) => target.emit(event, payload)))

type Callback = (error: Error | null | undefined) => void
