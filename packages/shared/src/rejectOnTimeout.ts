import { pause } from './pause.js'

export function rejectOnTimeout<T>(promise: Promise<T>, millis: number): Promise<T> {
  return Promise.race([
    promise,
    pause(millis).then(() => {
      throw new Error('timeout exceeded')
    }),
  ])
}
