import { TestChannel } from './TestChannel'
import { ConnectionContext, Connection, SendFunction } from '/connection'
import { pause } from './pause'

export const joinTestChannel = (channel: TestChannel) => (context: ConnectionContext) => {
  const id = context.user.userName

  // hook up send
  const sendMessage: SendFunction = msg => channel.write(id, msg)

  // Instantiate the connection service
  const connection = new Connection({ sendMessage, context }).start()

  // hook up receive
  channel.addListener('data', async (senderId, msg) => {
    if (senderId === id) return // I can ignore messages that I sent

    // simulate a random delay, then deliver the message
    const delay = 0 //Math.random() * 100
    // TODO: This will cause tests to intermittently fail; see TODO in connection.ts regarding timing of delivery
    await pause(delay)
    connection.deliver(msg)
  })

  channel.addPeer()

  return connection
}
