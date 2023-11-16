import { Connection } from 'connection/Connection.js'
import { type InitialContext, type SendFunction } from 'connection/types.js'
import { pause } from './pause.js'
import { type TestChannel } from './TestChannel.js'

/** Returns a function that can be used to join a specific test channel */
export const joinTestChannel = (channel: TestChannel) => (context: InitialContext) => {
  const { deviceId } = context.device

  // Hook up send
  const sendMessage: SendFunction = message => {
    channel.write(deviceId, message)
  }

  // Instantiate the connection service
  const connection = new Connection({ sendMessage, context })

  // Hook up receive
  channel.addListener('data', async (senderId, message) => {
    if (senderId === deviceId) {
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
