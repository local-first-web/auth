import { pause } from '@localfirst/shared'
import { describe, expect, it } from 'vitest'
import { MessageQueue } from '../MessageQueue.js'

const timeout = 10

describe('MessageQueue', () => {
  describe('one queue', () => {
    const setup = () => {
      const received: number[] = []
      const requested: number[] = []
      const sent: number[] = []

      const network = new MessageQueue<TestMessage>({
        sendMessage: message => sent.push(message.index),
        timeout,
      })

      network
        .on('message', message => received.push(message.index))
        .on('request', index => requested.push(index))

      return { network, received, requested, sent }
    }

    describe('outgoing', () => {
      it('sends messages', () => {
        const { network, sent } = setup()
        network //
          .start()
          .send({})
          .send({})
        expect(sent).toEqual([0, 1])
      })

      it('sends messages queued before start', () => {
        const { network, sent } = setup()
        network //
          .send({})
          .send({})
          .start()
        expect(sent).toEqual([0, 1])
      })

      it('sends messages queued while stopped', () => {
        const { network, sent } = setup()
        network //
          .start()
          .send({})
          .stop()
          .send({})
          .start()
        expect(sent).toEqual([0, 1])
      })

      it('resends messages on request', () => {
        const { network, sent } = setup()
        network //
          .start()
          .send({})
          .send({})
          .resend(0)
        expect(sent).toEqual([0, 1, 0])
      })

      it('throws when asked to resend a nonexistent message', () => {
        const { network } = setup()
        network //
          .start()
          .send({})
          .send({})
          .send({})
        expect(() => network.resend(42)).toThrow()
      })
    })

    describe('incoming', () => {
      it('emits messages', () => {
        const { network, received } = setup()
        network //
          .start()
          .receive({ index: 0 })
          .receive({ index: 1 })
          .receive({ index: 2 })
        expect(received).toEqual([0, 1, 2])
      })

      it('when messages are received out of order, emits them in order', () => {
        const { network, received } = setup()
        network
          .start()
          .receive({ index: 0 })
          .receive({ index: 2 }) // <- out of order
          .receive({ index: 1 })
        expect(received).toEqual([0, 1, 2])
      })

      it('ignores duplicate messages', () => {
        const { network, received } = setup()
        network
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
        const { network, received } = setup()

        // the network is not started yet
        network //
          .receive({ index: 0 })
          .receive({ index: 1 })
          .receive({ index: 2 })

        // Nothing is received
        expect(received).toEqual([])

        // once the network is started, messages are received in order
        network.start()
        expect(received).toEqual([0, 1, 2])
      })

      it('requests missing messages', async () => {
        const { network, received, requested } = setup()
        network //
          .start()
          .receive({ index: 0 })
          // .receive({ index: 1 }) // <- missing
          // .receive({ index: 2 }) // <- missing
          .receive({ index: 3 })
          .receive({ index: 4 })

        // messages 3 & 4 are not received because 1 & 2 are missing
        expect(received).toEqual([0])

        // after a delay, the network requests a resend for the missing messages
        await pause(timeout * 2)
        expect(requested).toEqual([1, 2])

        // we respond with the missing messages
        network //
          .receive({ index: 1 })
          .receive({ index: 2 })

        // once the missing messages are received, they are emitted in order
        expect(received).toEqual([0, 1, 2, 3, 4])
      })

      it('cancels the request if the missing message is received before the timeout', async () => {
        const { network, received, requested } = setup()
        network
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
        network //
          .receive({ index: 1 })
          .receive({ index: 2 })

        // since the missing messages arrived within the delay, we don't request a resend
        expect(requested).toEqual([])

        // once the missing messages are received, they are emitted in order
        expect(received).toEqual([0, 1, 2, 3, 4])
      })

      it(`re-requests a message if it still doesn't come`, async () => {
        const { network, requested } = setup()
        network
          .start()
          .receive({ index: 0 })
          // .receive({ index: 1 }) <- missing
          .receive({ index: 2 })

        // after a delay, the network requests a resend for the missing message
        await pause(timeout * 2)
        expect(requested).toEqual([1])

        // a new message comes but we still don't have the missing message
        network.receive({ index: 3 })

        // so we request it again
        await pause(timeout * 2)
        expect(requested).toEqual([1, 1])
      })

      it('does not receive messages while stopped', async () => {
        const { network, received } = setup()
        network //
          .start()
          .receive({ index: 0 })
        expect(received).toEqual([0])

        network //
          .stop()
          .receive({ index: 1 })
        expect(received).toEqual([0])
      })

      it('can be restarted after being stopped', async () => {
        const { network, received } = setup()
        network //
          .start()
          .receive({ index: 0 })
        expect(received).toEqual([0])

        network //
          .stop()
          .receive({ index: 1 })
        expect(received).toEqual([0])

        network //
          .start()
          .receive({ index: 2 })
        expect(received).toEqual([0, 1, 2])
      })
    })
  })

  describe('two queues', () => {
    const setup = () => {
      const alice: UserStuff = {
        queue: new MessageQueue<TestMessage>({
          sendMessage: message => bob.queue.receive(message),
          timeout,
        }),
        received: [],
      }

      const bob: UserStuff = {
        queue: new MessageQueue<TestMessage>({
          sendMessage: message => alice.queue.receive(message),
          timeout,
        }),
        received: [],
      }

      alice.queue.on('message', message => alice.received.push(message.index))
      bob.queue.on('message', message => bob.received.push(message.index))

      alice.queue.start()
      bob.queue.start()

      return { alice, bob }
    }

    it('sends and receives', () => {
      const { alice, bob } = setup()

      alice.queue.send({})
      alice.queue.send({})
      alice.queue.send({})
      expect(bob.received).toEqual([0, 1, 2])

      bob.queue.send({})
      bob.queue.send({})
      bob.queue.send({})
      expect(alice.received).toEqual([0, 1, 2])
    })

    it('ignores messages meant for another instance', () => {
      const { alice, bob } = setup()

      alice.queue.send({})
      alice.queue.send({})
      expect(bob.received).toEqual([0, 1])

      bob.queue.send({})
      bob.queue.send({})
      expect(alice.received).toEqual([0, 1])

      const bob2: UserStuff = {
        queue: new MessageQueue<TestMessage>({
          sendMessage: message => alice.queue.receive(message),
          timeout,
        }),
        received: [],
      }

      bob2.queue.start()
      bob2.queue.send({})
      bob2.queue.send({})
      bob2.queue.send({})
      bob2.queue.send({})
      bob2.queue.send({})

      expect(alice.received).toEqual([0, 1]) // <- still the same
    })
  })
})

// eslint-disable-next-line @typescript-eslint/ban-types
type TestMessage = {}

type UserStuff = {
  queue: MessageQueue<TestMessage>
  received: number[]
}
