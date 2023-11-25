// ignore file coverage

import type { EventEmitter } from 'eventemitter3'

/** Returns a promise that resolves when the given event is emitted on the given emitter. */
export const eventPromise = async <T extends EventEmitter>(emitter: T, event: string) =>
  new Promise<T>(resolve => {
    emitter.once(event, () => resolve(emitter))
  })
