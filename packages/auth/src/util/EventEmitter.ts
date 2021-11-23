import { EventEmitter as _EventEmitter } from 'events'
import debug from 'debug'

/** EventEmitter with built-in logging */
export class EventEmitter extends _EventEmitter {
  /** The `log` method is meant to be overridden, e.g.
   * ```ts
   *  this.log = debug(`lf:auth:demo:conn:${context.user.userName}`)
   * ```
   */
  log: debug.Debugger = debug(`EventEmitter`)

  public emit(event: string, ...args: any[]) {
    this.log(`emit ${event}`, ...args)
    return super.emit(event, ...args)
  }
}
