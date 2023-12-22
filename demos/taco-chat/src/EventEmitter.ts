import debug from 'debug'
import { EventEmitter as _EventEmitter } from 'eventemitter3'

/** EventEmitter with built-in logging */
export class EventEmitter<
  EventTypes extends _EventEmitter.ValidEventTypes = string | symbol,
  Context extends any = any,
> extends _EventEmitter<EventTypes, Context> {
  /** The `log` method is meant to be overridden, e.g.
   * ```ts
   *  this.log = debug(`lf:auth:demo:conn:${context.user.userName}`)
   * ```
   */
  log: debug.Debugger = debug(`EventEmitter`)

  public emit<T extends _EventEmitter.EventNames<EventTypes>>(
    event: T,
    ...args: _EventEmitter.EventArgs<EventTypes, T>
  ) {
    this.log(`emit ${String(event)} %o`, ...args)
    return super.emit(event, ...args)
  }
}
