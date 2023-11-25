import { EventEmitter } from 'eventemitter3'

/**
 * Receives numbered messages and emits them in order. If a message is missing after a delay, asks
 * for it to be sent (or resent).
 */
export class OrderedNetwork<T> extends EventEmitter<OrderedNetworkEvents<T>> {
  #received: Record<number, NumberedMessage<T>> = {}
  #nextIndex = 0
  #started = false
  #timeout: number
  #waiting: Record<number, TimeoutId> = {}

  constructor({ timeout = 1000 }: Options = {}) {
    super()
    this.#timeout = timeout
  }

  /**
   * Messages can be received before the service is started (e.g. while waiting to be ready to send
   * over the network). They will be emitted in order when start() is called.
   */
  public start() {
    this.#started = true
    this.#processQueue()
  }

  /**
   * Stop emitting messages. Messages will be queued until start() is called again.
   */
  public stop() {
    this.#started = false
  }

  /**
   * Queues incoming messages and, if we're started, emits them in order.
   */
  public deliver(message: NumberedMessage<T>): void {
    const { index } = message
    if (this.#received[index]) return // already received
    this.#received[index] = message
    if (this.#started) this.#processQueue()
  }

  /**
   * Emits any messages that are next in sequence, and requests any missing messages.
   */
  #processQueue = () => {
    while (this.#received[this.#nextIndex]) {
      const message = this.#received[this.#nextIndex]
      this.#nextIndex++
      this.emit('message', message)
    }
    // identify missing messages
    const highest = Math.max(...Object.keys(this.#received).map(Number))
    for (let i = this.#nextIndex; i < highest; i++) {
      if (this.#waiting[i]) continue // already waiting
      // wait for the message to come
      this.#waiting[i] = setTimeout(() => {
        // if it still hasn't come, request it
        if (!this.#received[i]) this.emit('request', i)
        delete this.#waiting[i]
      }, this.#timeout)
    }
  }
}

export type NumberedMessage<T> = T & { index: number }

export type OrderedNetworkEvents<T> = {
  message: (message: NumberedMessage<T>) => void
  request: (index: number) => void
}

type Options = {
  /** Time to wait (in ms) before requesting a missing message */
  timeout?: number
}

type TimeoutId = ReturnType<typeof setTimeout>
