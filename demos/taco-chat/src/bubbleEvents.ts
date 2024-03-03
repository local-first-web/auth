import { EventEmitter } from '@herbcaudill/eventemitter42'

export const bubbleEvents = (
  source: EventEmitter<any>,
  target: EventEmitter<any>,
  events: string[]
) => {
  for (const event of events) source.on(event, payload => target.emit(event, payload))
}
