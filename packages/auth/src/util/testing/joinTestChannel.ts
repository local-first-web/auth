import { pause } from './pause.js'
import { type TestChannel } from './TestChannel.js'
import { Connection } from '@/connection/Connection.js'
import { type InitialContext, type SendFunction } from '@/connection/types.js'
import { getDeviceId } from '@/device/index.js'

/** Returns a function that can be used to join a specific test channel */
export const joinTestChannel = (channel: TestChannel) => (context: InitialContext) => {
  const id = getDeviceId(context.device)

  // Hook up send
  const sendMessage: SendFunction = message => {
    channel.write(id, message)
  }

  // Instantiate the connection service
  const connection = new Connection({ sendMessage, context })

  // Hook up receive
  channel.addListener('data', async (senderId, message) => {
    if (senderId === id) {
      return
    } // ignore messages that I sent

    // simulate a random delay, then deliver the message
    const delay = 1 // Math.floor(Math.random() * 100)
    await pause(delay)
    void connection.deliver(message)
  })

  channel.addPeer()

  return connection
}
