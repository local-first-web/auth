import debug from 'debug'
import { EventArgs, EventMap, EventEmitter as _EventEmitter } from '@herbcaudill/eventemitter42'

/** EventEmitter with built-in logging */
export class EventEmitter<EventTypes extends EventMap> extends _EventEmitter<EventTypes> {
  /** The `log` method is meant to be overridden, e.g.
   * ```ts
   *  this.log = debug(`lf:auth:demo:conn:${context.user.userName}`)
   * ```
   */
  log: debug.Debugger = debug(`EventEmitter`)

  public emit<K extends keyof EventTypes>(event: K, ...args: EventArgs<EventTypes, K>) {
    this.log(`emit ${String(event)} %o`, ...args)
    return super.emit(event, ...args)
  }
}
