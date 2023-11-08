import { Connection } from 'connection/Connection.js'
import { isServer, type InitialContext, type SendFunction } from 'connection/types.js'
import { pause } from './pause.js'
import { type TestChannel } from './TestChannel.js'

/** Returns a function that can be used to join a specific test channel */
export const joinTestChannel = (channel: TestChannel) => (context: InitialContext) => {
  const id = isServer(context) ? context.server.host : context.device.deviceId
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
    connection.deliver(message)
  })

  channel.addPeer()

  return connection
}
