export type Queue<M extends Indexed> = Record<number, M>

export interface Indexed {
  index: number
}
export type Unindexed<T> = Omit<T, 'index'>

/**
 * Given a message queue and an incoming message, returns a new queue and an array of messages that
 * are ready to be delivered. Messages that are received out of order are held until their
 * predecessors arrive.
 * @param queue The queue at the time the message was received
 * @param message The incoming message
 * @returns `{queue, nextMessages}`:
 *   - `queue` The updated queue
 *   - `nextMessages` An array of zero or more messages that are ready to be delivered
 */
export const orderedDelivery = <M extends Indexed>(queue: Queue<M>, message: M) => {
  const { index } = message
  const updatedQueue: Queue<M> = { ...queue, [index]: message }
  const highestIndex = highest(updatedQueue)

  const nextMessages = [] as M[]
  let nextIndex = firstGap(queue)
  while (nextIndex in updatedQueue && nextIndex <= highestIndex) {
    nextMessages.push(updatedQueue[nextIndex])
    nextIndex += 1
  }
  return { queue: updatedQueue, nextMessages }
}

const firstGap = <M extends Indexed>(queue: Queue<M>) => {
  let i = 0
  while (i in queue) i += 1
  return i
}

const highest = <M extends Indexed>(queue: Queue<M>) => Math.max(...Object.keys(queue).map(Number))
