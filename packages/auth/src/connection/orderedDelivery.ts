/**
 * Given a message queue and an incoming message, returns a new queue and an array of messages that
 * are ready to be delivered. Messages that are received out of order are held until their
 * predecessors arrive.
 * @returns `{queue, nextMessages}`:
 *   - `queue` The updated queue
 *   - `nextMessages` An array of zero or more messages that are ready to be delivered
 */
export const orderedDelivery = <M extends Indexed>(
  /** The queue at the time the message was received */
  queue: Queue<M>,
  /** The incoming message */
  message: M
) => {
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
  while (i in queue) {
    i += 1
  }

  return i
}

const highest = <M extends Indexed>(queue: Queue<M>) => Math.max(...Object.keys(queue).map(Number))

// TYPES

export type Queue<M extends Indexed> = Record<number, M>

export type Indexed = {
  index: number
}

export type Unindexed<T> = Omit<T, 'index'>
