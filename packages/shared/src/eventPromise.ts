import { eventPromise, type EventEmitter, type EventMap } from '@herbcaudill/eventemitter42'

export { eventPromise } from '@herbcaudill/eventemitter42'

export const eventPromises = async <T extends EventMap>(
  emitters: Array<EventEmitter<T>>,
  event: string
) => {
  const promises = emitters.map(async emitter => eventPromise(emitter, event))
  return Promise.all(promises)
}
