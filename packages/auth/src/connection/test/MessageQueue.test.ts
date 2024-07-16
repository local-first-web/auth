import { pause } from '@localfirst/shared'
import { describe, expect, it } from 'vitest'
import { MessageQueue, type NumberedMessage } from '../MessageQueue.js'
import { EventEmitter } from '@herbcaudill/eventemitter42'
import { createId } from '@paralleldrive/cuid2'

const timeout = 10

describe('MessageQueue', () => {
  describe('one queue', () => {
    const setup = () => {
      const received: number[] = []
      const requested: number[] = []
      const sent: number[] = []

      const queue = new MessageQueue<TestMessage>({
        sendMessage: message => sent.push(message.index),
        timeout,
      })

      queue
        .on('message', message => received.push(message.index))
        .on('request', index => requested.push(index))

      return { queue, received, requested, sent }
    }

    describe('outgoing', () => {
      it('sends messages', () => {
        const { queue, sent } = setup()
        queue //
          .start()
          .send({})
          .send({})
        expect(sent).toEqual([0, 1])
      })

      it('sends messages queued before start', () => {
        const { queue, sent } = setup()
        queue //
          .send({})
          .send({})
          .start()
        expect(sent).toEqual([0, 1])
      })

      it('sends messages queued while stopped', () => {
        const { queue, sent } = setup()
        queue //
          .start()
          .send({})
          .stop()
          .send({})
          .start()
        expect(sent).toEqual([0, 1])
      })

      it('resends messages on request', () => {
        const { queue, sent } = setup()
        queue //
          .start()
          .send({})
          .send({})
          .resend(0)
        expect(sent).toEqual([0, 1, 0])
      })

      it('throws when asked to resend a nonexistent message', () => {
        const { queue } = setup()
        queue //
          .start()
          .send({})
          .send({})
          .send({})
        expect(() => queue.resend(42)).toThrow()
      })
    })

    describe('incoming', () => {
      it('emits messages', () => {
        const { queue, received } = setup()
        queue //
          .start()
          .receive({ index: 0 })
          .receive({ index: 1 })
          .receive({ index: 2 })
        expect(received).toEqual([0, 1, 2])
      })

      it('when messages are received out of order, emits them in order', () => {
        const { queue, received } = setup()
        queue
          .start()
          .receive({ index: 0 })
          .receive({ index: 2 }) // <- out of order
          .receive({ index: 1 })
        expect(received).toEqual([0, 1, 2])
      })

      it('ignores duplicate messages', () => {
        const { queue, received } = setup()
        queue
          .start()
          .receive({ index: 0 })
          .receive({ index: 1 })
          .receive({ index: 1 }) // <- duplicate
          .receive({ index: 2 })
          .receive({ index: 0 }) // <- duplicate
          .receive({ index: 2 }) // <- duplicate
        expect(received).toEqual([0, 1, 2])
      })

      it('emits messages received before start', () => {
        const { queue, received } = setup()

        // the queue is not started yet
        queue //
          .receive({ index: 0 })
          .receive({ index: 1 })
          .receive({ index: 2 })

        // Nothing is received
        expect(received).toEqual([])

        // once the queue is started, messages are received in order
        queue.start()
        expect(received).toEqual([0, 1, 2])
      })

      it('requests missing messages', async () => {
        const { queue, received, requested } = setup()
        queue //
          .start()
          .receive({ index: 0 })
          // .receive({ index: 1 }) // <- missing
          // .receive({ index: 2 }) // <- missing
          .receive({ index: 3 })
          .receive({ index: 4 })

        // messages 3 & 4 are not received because 1 & 2 are missing
        expect(received).toEqual([0])

        // after a delay, the queue requests a resend for the missing messages
        await pause(timeout * 2)
        expect(requested).toEqual([1, 2])

        // we respond with the missing messages
        queue //
          .receive({ index: 1 })
          .receive({ index: 2 })

        // once the missing messages are received, they are emitted in order
        expect(received).toEqual([0, 1, 2, 3, 4])
      })

      it('cancels the request if the missing message is received before the timeout', async () => {
        const { queue, received, requested } = setup()
        queue
          .start()
          .receive({ index: 0 })
          // .receive({ index: 1 }) <- missing
          // .receive({ index: 2 }) <- missing
          .receive({ index: 3 })
          .receive({ index: 4 })

        // messages 3 & 4 are not emitted because 1 & 2 are missing
        expect(received).toEqual([0])

        // after a short delay, the missing messages arrive
        await pause(timeout / 2)
        queue //
          .receive({ index: 1 })
          .receive({ index: 2 })

        // since the missing messages arrived within the delay, we don't request a resend
        expect(requested).toEqual([])

        // once the missing messages are received, they are emitted in order
        expect(received).toEqual([0, 1, 2, 3, 4])
      })

      it(`re-requests a message if it still doesn't come`, async () => {
        const { queue, requested } = setup()
        queue
          .start()
          .receive({ index: 0 })
          // .receive({ index: 1 }) <- missing
          .receive({ index: 2 })

        // after a delay, the queue requests a resend for the missing message
        await pause(timeout * 2)
        expect(requested).toEqual([1])

        // a new message comes but we still don't have the missing message
        queue.receive({ index: 3 })

        // so we request it again
        await pause(timeout * 2)
        expect(requested).toEqual([1, 1])
      })

      it('does not receive messages while stopped', async () => {
        const { queue, received } = setup()
        queue //
          .start()
          .receive({ index: 0 })
        expect(received).toEqual([0])

        queue //
          .stop()
          .receive({ index: 1 })
        expect(received).toEqual([0])
      })

      it('can be restarted after being stopped', async () => {
        const { queue, received } = setup()
        queue //
          .start()
          .receive({ index: 0 })
        expect(received).toEqual([0])

        queue //
          .stop()
          .receive({ index: 1 })
        expect(received).toEqual([0])

        queue //
          .start()
          .receive({ index: 2 })
        expect(received).toEqual([0, 1, 2])
      })
    })
  })

  describe('two queues ', () => {
    // creates new MessageQueue instances for alice and bob on the given channel
    const setup = (channel: TestChannel) => {
      const makeUser = (peerId: string, targetPeerId: string) => {
        const user: UserStuff = {
          peerId,
          queue: new MessageQueue<TestMessage>({
            sendMessage(message) {
              channel.write(targetPeerId, message)
            },
            timeout,
          }),
          received: [],
        }
        user.queue.on('message', message => user.received.push(message.index))
        channel.on('data', (recipientId, message) => {
          if (recipientId !== peerId) return
          user.queue.receive(message)
        })

        channel.addPeer()

        return user
      }

      // Using random peer IDs because that's what we'd do in real life
      const alicePeerId = createId()
      const bobPeerId = createId()

      const alice = makeUser(alicePeerId, bobPeerId)
      const bob = makeUser(bobPeerId, alicePeerId)

      alice.queue.start()
      bob.queue.start()

      return { alice, bob }
    }

    it('sends and receives', () => {
      const channel = new TestChannel()
      const { alice, bob } = setup(channel)

      alice.queue.send({})
      alice.queue.send({})
      alice.queue.send({})
      expect(bob.received).toEqual([0, 1, 2])

      bob.queue.send({})
      bob.queue.send({})
      expect(alice.received).toEqual([0, 1])
    })
  })
})

// eslint-disable-next-line @typescript-eslint/ban-types
type TestMessage = {}

type UserStuff = {
  peerId: string
  queue: MessageQueue<TestMessage>
  received: number[]
}

class TestChannel extends EventEmitter<TestChannelEvents> {
  private peers = 0
  private readonly buffer: Array<{ recipientId: string; msg: NumberedMessage<TestMessage> }> = []

  addPeer() {
    this.peers += 1
    if (this.peers > 1) {
      // Someone was already connected, emit any buffered messages
      while (this.buffer.length > 0) {
        const { recipientId, msg } = this.buffer.pop() as {
          recipientId: string
          msg: NumberedMessage<TestMessage>
        }
        this.emit('data', recipientId, msg)
      }
    }
  }

  write(recipientId: string, message: NumberedMessage<TestMessage>) {
    if (this.peers > 1) {
      // At least one peer besides us connected
      this.emit('data', recipientId, message)
    } else {
      // Nobody else connected, buffer messages until someone connects
      this.buffer.unshift({ recipientId, msg: message })
    }
  }
}

type TestChannelEvents = {
  data: (recipientId: string, message: NumberedMessage<TestMessage>) => void
}
