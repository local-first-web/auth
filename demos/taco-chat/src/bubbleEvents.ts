import { EventEmitter } from 'eventemitter3'

export const bubbleEvents = (
  source: EventEmitter<any>,
  target: EventEmitter<any>,
  events: string[]
) => {
  for (const event of events) source.on(event, payload => target.emit(event, payload))
}
