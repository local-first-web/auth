import debug from 'debug'
import _EventEmitter, { type EventArgs, type EventNames, type ValidEventTypes } from 'eventemitter3'

/** EventEmitter with built-in logging */
export class EventEmitter<
  EventTypes extends ValidEventTypes = string | symbol,
  Context = any,
> extends _EventEmitter<EventTypes, Context> {
  /** The `log` method is meant to be overridden, e.g.
   * ```ts
   *  this.log = debug(`lf:auth:demo:conn:${context.user.userName}`)
   * ```
   */
  log: debug.Debugger = debug('EventEmitter')

  public emit<T extends EventNames<EventTypes>>(event: T, ...args: EventArgs<EventTypes, T>) {
    this.log(`emit ${String(event)} %o`, ...args)
    return super.emit(event, ...args)
  }
}
