import { pause } from '@localfirst/shared'
import { describe, expect, it } from 'vitest'
import { MessageQueue } from '../MessageQueue.js'
import { EventEmitter } from 'ws'

const timeout = 10

describe('MessageQueue', () => {
  describe('one queue', () => {
    const sessionId = '123'

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
          .receive({ index: 0, sessionId })
          .receive({ index: 1, sessionId })
          .receive({ index: 2, sessionId })
        expect(received).toEqual([0, 1, 2])
      })

      it('when messages are received out of order, emits them in order', () => {
        const { queue, received } = setup()
        queue
          .start()
          .receive({ index: 0, sessionId })
          .receive({ index: 2, sessionId }) // <- out of order
          .receive({ index: 1, sessionId })
        expect(received).toEqual([0, 1, 2])
      })

      it('ignores duplicate messages', () => {
        const { queue, received } = setup()
        queue
          .start()
          .receive({ index: 0, sessionId })
          .receive({ index: 1, sessionId })
          .receive({ index: 1, sessionId }) // <- duplicate
          .receive({ index: 2, sessionId })
          .receive({ index: 0, sessionId }) // <- duplicate
          .receive({ index: 2, sessionId }) // <- duplicate
        expect(received).toEqual([0, 1, 2])
      })

      it('emits messages received before start', () => {
        const { queue, received } = setup()

        // the queue is not started yet
        queue //
          .receive({ index: 0, sessionId })
          .receive({ index: 1, sessionId })
          .receive({ index: 2, sessionId })

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
          .receive({ index: 0, sessionId })
          // .receive({ index: 1, sessionId }) // <- missing
          // .receive({ index: 2, sessionId }) // <- missing
          .receive({ index: 3, sessionId })
          .receive({ index: 4, sessionId })

        // messages 3 & 4 are not received because 1 & 2 are missing
        expect(received).toEqual([0])

        // after a delay, the queue requests a resend for the missing messages
        await pause(timeout * 2)
        expect(requested).toEqual([1, 2])

        // we respond with the missing messages
        queue //
          .receive({ index: 1, sessionId })
          .receive({ index: 2, sessionId })

        // once the missing messages are received, they are emitted in order
        expect(received).toEqual([0, 1, 2, 3, 4])
      })

      it('cancels the request if the missing message is received before the timeout', async () => {
        const { queue, received, requested } = setup()
        queue
          .start()
          .receive({ index: 0, sessionId })
          // .receive({ index: 1, sessionId }) <- missing
          // .receive({ index: 2, sessionId }) <- missing
          .receive({ index: 3, sessionId })
          .receive({ index: 4, sessionId })

        // messages 3 & 4 are not emitted because 1 & 2 are missing
        expect(received).toEqual([0])

        // after a short delay, the missing messages arrive
        await pause(timeout / 2)
        queue //
          .receive({ index: 1, sessionId })
          .receive({ index: 2, sessionId })

        // since the missing messages arrived within the delay, we don't request a resend
        expect(requested).toEqual([])

        // once the missing messages are received, they are emitted in order
        expect(received).toEqual([0, 1, 2, 3, 4])
      })

      it(`re-requests a message if it still doesn't come`, async () => {
        const { queue, requested } = setup()
        queue
          .start()
          .receive({ index: 0, sessionId })
          // .receive({ index: 1, sessionId }) <- missing
          .receive({ index: 2, sessionId })

        // after a delay, the queue requests a resend for the missing message
        await pause(timeout * 2)
        expect(requested).toEqual([1])

        // a new message comes but we still don't have the missing message
        queue.receive({ index: 3, sessionId })

        // so we request it again
        await pause(timeout * 2)
        expect(requested).toEqual([1, 1])
      })

      it('does not receive messages while stopped', async () => {
        const { queue, received } = setup()
        queue //
          .start()
          .receive({ index: 0, sessionId })
        expect(received).toEqual([0])

        queue //
          .stop()
          .receive({ index: 1, sessionId })
        expect(received).toEqual([0])
      })

      it('can be restarted after being stopped', async () => {
        const { queue, received } = setup()
        queue //
          .start()
          .receive({ index: 0, sessionId })
        expect(received).toEqual([0])

        queue //
          .stop()
          .receive({ index: 1, sessionId })
        expect(received).toEqual([0])

        queue //
          .start()
          .receive({ index: 2, sessionId })
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

    it('brent raining on my parade', () => {
      // what if the first message I get wasn't intended for me

      let bob2: UserStuff | undefined // eslint-disable-line prefer-const

      // the queue only knows about peer IDs, so alice's messages to bob
      // go to both bob1 and bob2
      const alice1: UserStuff = {
        queue: new MessageQueue<TestMessage>({
          sendMessage(message) {
            bob1.queue.receive(message)
            bob2?.queue.receive(message)
          },
          timeout,
        }),
        received: [],
      }

      const bob1: UserStuff = {
        queue: new MessageQueue<TestMessage>({
          sendMessage: message => alice1.queue.receive(message),
          timeout,
        }),
        received: [],
      }

      alice1.queue.on('message', message => alice1.received.push(message.index))
      bob1.queue.on('message', message => bob1.received.push(message.index))

      alice1.queue.start()
      bob1.queue.start()

      alice1.queue.send({})
      alice1.queue.send({})
      expect(bob1.received).toEqual([0, 1])

      bob1.queue.send({})
      bob1.queue.send({})
      expect(alice1.received).toEqual([0, 1])

      bob2 = {
        queue: new MessageQueue<TestMessage>({
          sendMessage: message => alice1.queue.receive(message),
          timeout,
        }),
        received: [],
      }
      bob2.queue.on('message', message => bob2.received.push(message.index))
      bob2.queue.start()

      alice1.queue.send({})
      alice1.queue.send({})
      alice1.queue.send({})
      alice1.queue.send({})
      alice1.queue.send({})
      alice1.queue.send({})

      expect(bob1.received).toEqual([0, 1, 2, 3, 4, 5, 6, 7]) // <- bob1 received everything
      expect(bob2.received).toEqual([]) // bob2 hasn't received anything because the first index was 3

      const alice2: UserStuff = {
        queue: new MessageQueue<TestMessage>({
          sendMessage(message) {
            bob1.queue.receive(message)
            bob2?.queue.receive(message)
          },
          timeout,
        }),
        received: [],
      }
      alice2.queue.start()

      alice2.queue.send({})
      alice2.queue.send({})
      alice2.queue.send({})

      expect(bob1.received).toEqual([0, 1, 2, 3, 4, 5, 6, 7]) // <- bob1 didn't receive any of those messages
      expect(bob2.received).toEqual([0, 1, 2]) //
    })
  })

  describe('two queues but better', () => {
    const setup = () => {
      const channel = new TestChannel()

      const makeUser = (peerId: string) => {
        return {
          peerId,

          queue: new MessageQueue<TestMessage>({
            sendMessage: message => {
              channel.write(peerId, message)
            },
            timeout,
          }),
        }
      }

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

    // it('sends and receives', () => {
    //   const { alice, bob } = setup()

    //   alice.queue.send({})
    //   alice.queue.send({})
    //   alice.queue.send({})
    //   expect(bob.received).toEqual([0, 1, 2])

    //   bob.queue.send({})
    //   bob.queue.send({})
    //   bob.queue.send({})
    //   expect(alice.received).toEqual([0, 1, 2])
    // })

    // it('ignores messages meant for another instance', () => {
    //   const { alice, bob } = setup()

    //   alice.queue.send({})
    //   alice.queue.send({})
    //   expect(bob.received).toEqual([0, 1])

    //   bob.queue.send({})
    //   bob.queue.send({})
    //   expect(alice.received).toEqual([0, 1])

    //   const bob2: UserStuff = {
    //     queue: new MessageQueue<TestMessage>({
    //       sendMessage: message => alice.queue.receive(message),
    //       timeout,
    //     }),
    //     received: [],
    //   }

    //   bob2.queue.start()
    //   bob2.queue.send({})
    //   bob2.queue.send({})
    //   bob2.queue.send({})
    //   bob2.queue.send({})
    //   bob2.queue.send({})

    //   expect(alice.received).toEqual([0, 1]) // <- still the same
    // })

    // it('brent raining on my parade', () => {
    //   // what if the first message I get wasn't intended for me

    //   let bob2: UserStuff | undefined // eslint-disable-line prefer-const

    //   // the queue only knows about peer IDs, so alice's messages to bob
    //   // go to both bob1 and bob2
    //   const alice1: UserStuff = {
    //     queue: new MessageQueue<TestMessage>({
    //       sendMessage(message) {
    //         bob1.queue.receive(message)
    //         bob2?.queue.receive(message)
    //       },
    //       timeout,
    //     }),
    //     received: [],
    //   }

    //   const bob1: UserStuff = {
    //     queue: new MessageQueue<TestMessage>({
    //       sendMessage: message => alice1.queue.receive(message),
    //       timeout,
    //     }),
    //     received: [],
    //   }

    //   alice1.queue.on('message', message => alice1.received.push(message.index))
    //   bob1.queue.on('message', message => bob1.received.push(message.index))

    //   alice1.queue.start()
    //   bob1.queue.start()

    //   alice1.queue.send({})
    //   alice1.queue.send({})
    //   expect(bob1.received).toEqual([0, 1])

    //   bob1.queue.send({})
    //   bob1.queue.send({})
    //   expect(alice1.received).toEqual([0, 1])

    //   bob2 = {
    //     queue: new MessageQueue<TestMessage>({
    //       sendMessage: message => alice1.queue.receive(message),
    //       timeout,
    //     }),
    //     received: [],
    //   }
    //   bob2.queue.on('message', message => bob2.received.push(message.index))
    //   bob2.queue.start()

    //   alice1.queue.send({})
    //   alice1.queue.send({})
    //   alice1.queue.send({})
    //   alice1.queue.send({})
    //   alice1.queue.send({})
    //   alice1.queue.send({})

    //   expect(bob1.received).toEqual([0, 1, 2, 3, 4, 5, 6, 7]) // <- bob1 received everything
    //   expect(bob2.received).toEqual([]) // bob2 hasn't received anything because the first index was 3

    //   const alice2: UserStuff = {
    //     queue: new MessageQueue<TestMessage>({
    //       sendMessage(message) {
    //         bob1.queue.receive(message)
    //         bob2?.queue.receive(message)
    //       },
    //       timeout,
    //     }),
    //     received: [],
    //   }
    //   alice2.queue.start()

    //   alice2.queue.send({})
    //   alice2.queue.send({})
    //   alice2.queue.send({})

    //   expect(bob1.received).toEqual([0, 1, 2, 3, 4, 5, 6, 7]) // <- bob1 didn't receive any of those messages
    //   expect(bob2.received).toEqual([0, 1, 2]) //
    // })
  })
})

// eslint-disable-next-line @typescript-eslint/ban-types
type TestMessage = {
  peerId: string
}

type UserStuff = {
  queue: MessageQueue<TestMessage>
  received: number[]
}

type UserStuffButBetter = {
  peerId: string
  queue: MessageQueue<TestMessage>
  received: number[]
}

export class TestChannel extends EventEmitter<TestChannelEvents> {
  private peers = 0
  private readonly buffer: Array<{ senderId: string; msg: Uint8Array }> = []

  addPeer() {
    this.peers += 1
    if (this.peers > 1) {
      // Someone was already connected, emit any buffered messages
      while (this.buffer.length > 0) {
        const { senderId, msg } = this.buffer.pop() as {
          senderId: string
          msg: Uint8Array
        }
        this.emit('data', senderId, msg)
      }
    }
  }

  write(senderId: string, message: Uint8Array) {
    if (this.peers > 1) {
      // At least one peer besides us connected
      this.emit('data', senderId, message)
    } else {
      // Nobody else connected, buffer messages until someone connects
      this.buffer.unshift({ senderId, msg: message })
    }
  }
}

type TestChannelEvents = {
  data: (senderId: string, message: Uint8Array) => void
}
