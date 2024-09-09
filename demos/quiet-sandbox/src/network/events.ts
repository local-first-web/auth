import { EventEmitter } from "stream"
import { createQsbLogger, QuietLogger } from "../utils/logger/logger.js"

export enum EVENTS {
  INITIALIZED_CHAIN = 'INITIALIZED_CHAIN',
  DIAL_FINISHED = 'DIAL_FINISHED',
  AUTH_TIMEOUT = 'AUTH_TIMEOUT',
  MISSING_DEVICE = 'MISSING_DEVICE'
}

export class QuietAuthEvents {
  private _events: EventEmitter
  private _LOGGER: QuietLogger

  constructor(identifier: string) {
    this._events = new EventEmitter()
    this._LOGGER = createQsbLogger(`quietAuthEvents:${identifier}`)
  }

  public emit(event: EVENTS, ...args: any[]) {
    this._LOGGER.debug(`emit ${event}`)
    this._events.emit(event, ...args)
  }

  public on(event: EVENTS, listener: (...args: any[]) => void) {
    this._events.on(
      event, 
      // this.appendLogToListener(event, listener)
      listener
    )
  }

  public once(event: EVENTS, listener: (...args: any[]) => void) {
    this._events.once(
      event, 
      // this.appendLogToListener(event, listener)
      listener
    )
  }
}