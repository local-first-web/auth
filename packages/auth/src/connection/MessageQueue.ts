import { EventEmitter } from 'eventemitter3'
import { debug } from '@localfirst/shared'

const log = debug.extend('message-queue')
/**
 * Receives numbered inbound messages and emits them in order. If a message is missing after a delay, asks
 * for it to be sent (or resent).
 *
 * Numbers and sends outbound messages, and responds to requests for missing messages.
 */
export class MessageQueue<T> extends EventEmitter<MessageQueueEvents<T>> {
  #started = false

  #inbound: Record<number, NumberedMessage<T>> = {}
  #nextInbound = 0
  #waiting: Record<number, TimeoutId> = {}
  readonly #timeout: number

  #outbound: Record<number, NumberedMessage<T>> = {}
  #nextOutbound = 0
  readonly #sendMessage: (message: NumberedMessage<T>) => void

  constructor({ sendMessage, timeout = 1000 }: Options<T>) {
    super()
    this.#sendMessage = (message: NumberedMessage<T>) => {
      this.#nextOutbound = message.index + 1
      sendMessage(message)
    }
    this.#timeout = timeout
  }

  /**
   * Messages can be received before the service is started (e.g. while waiting to be ready to send
   * over the network). They will be emitted in order when start() is called.
   */
  public start() {
    this.#started = true
    this.#processInbound()
    this.#processOutbound()
    return this
  }

  /**
   * Stop emitting messages. Messages will be queued until start() is called again.
   */
  public stop() {
    this.#started = false
    return this
  }

  /**
   * Assigns a number to the message and sends it.
   */
  public send(message: T) {
    const index = highestIndex(this.#outbound) + 1
    const numberedMessage = { ...message, index }
    this.#outbound[index] = numberedMessage
    log('send %o', numberedMessage)
    if (this.#started) this.#sendMessage(numberedMessage)
    return this
  }

  /**
   * Resends a message that was previously sent.
   */
  public resend(index: number) {
    const message = this.#outbound[index]
    if (!message)
      throw new Error(`Received resend request for message #${index}, which doesn't exist.`)
    log('resend %o', message)
    this.#sendMessage(message)
    return this
  }

  /**
   * Queues inbound messages and, if we're started, emits them in order.
   */
  public receive(message: NumberedMessage<T>) {
    const { index } = message
    log('receive %o', message)
    if (!this.#inbound[index]) {
      this.#inbound[index] = message
      if (this.#started) this.#processInbound()
    }
    return this
  }

  #processOutbound() {
    // send outbound messages in order
    log('processOutbound')
    while (this.#outbound[this.#nextOutbound]) {
      const message = this.#outbound[this.#nextOutbound]
      this.#sendMessage(message)
    }
  }

  /**
   * Receives any messages that are pending in the inbound queue, and requests any missing messages.
   */
  #processInbound() {
    log('processInbound')
    // emit received messages in order
    while (this.#inbound[this.#nextInbound]) {
      const message = this.#inbound[this.#nextInbound]
      this.#nextInbound++
      this.emit('message', message)
    }
    // identify missing messages
    const highest = highestIndex(this.#inbound)
    for (let i = this.#nextInbound; i < highest; i++) {
      if (this.#waiting[i]) continue // already waiting
      // wait for the message to come
      this.#waiting[i] = setTimeout(() => {
        // if it still hasn't come, request it
        if (!this.#inbound[i]) this.emit('request', i)

        // TODO use maps instead
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.#waiting[i]
      }, this.#timeout)
    }
  }
}

// HELPERS

function highestIndex(queue: Record<number, any>) {
  return Math.max(...Object.keys(queue).map(Number), -1)
}

// TYPES

export type NumberedMessage<T> = T & { index: number }

export type MessageQueueEvents<T> = {
  message: (message: NumberedMessage<T>) => void
  request: (index: number) => void
}

type Options<T> = {
  /** Send function */
  sendMessage: (message: NumberedMessage<T>) => void

  /** Time to wait (in ms) before requesting a missing message */
  timeout?: number
}

type TimeoutId = ReturnType<typeof setTimeout>
