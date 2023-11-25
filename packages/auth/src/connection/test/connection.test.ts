import { pause } from 'util/testing/pause.js'
import { Connection } from '../Connection.js'
import type { SendFunction } from '../types.js'
import { TestChannel, setup } from 'util/testing/index.js'
import { describe, it } from 'vitest'

// NEXT: The way this is currently set up is goofy, the connection should just hold on to messages
// received before start in the same way it holds on to messages received out of order. It shouldn't be the application's
// responsibility to hold on to messages received before start.

describe.skip('connection', () => {
  it('should deliver messages that were received before start', () => {
    const { alice, bob } = setup('alice', 'bob')

    const join = joinTestChannel(new TestChannel())

    const aliceConnection = join(alice.connectionContext)
    const bobConnection = join(bob.connectionContext)

    aliceConnection.start()

    setTimeout(() => {
      bobConnection.start()
    }, 1000)
  })
})

export const joinTestChannel = (channel: TestChannel) => (context: InitialContext) => {
  const id = context.device.deviceId

  // Hook up send
  const sendMessage: SendFunction = message => {
    channel.write(id, message)
  }

  // Instantiate the connection service
  const connection = new Connection({ sendMessage, context })

  // Hook up receive
  channel.addListener('data', async (senderId, message) => {
    if (senderId === id) return // ignore messages that I sent

    // simulate a random delay, then deliver the message
    const delay = 1 // Math.floor(Math.random() * 100)
    await pause(delay)
    connection.deliver(message)
  })

  channel.addPeer()

  return connection
}
