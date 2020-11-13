import { TestChannel } from './TestChannel'
import { ConnectionContext, ConnectionService } from '/connection'
import { pause } from '/connection/pause'
import { ConnectionMessage } from '/message'

export const joinTestChannel = (channel: TestChannel) => (
  id: string,
  context: ConnectionContext
) => {
  // hook up send
  const sendMessage = (msg: ConnectionMessage) => channel.write(id, msg)

  // Instantiate the connection service
  const connection = new ConnectionService({ sendMessage, context }).start()

  // hook up receive
  channel.addListener('data', async (senderId, msg) => {
    if (senderId === id) return // I can ignore messages that I sent

    // simulate a random delay, then deliver the message
    // const delay = Math.random() * 100
    // TODO: This will cause tests to intermittently fail; see TODO in connection.ts regarding timing of delivery

    await pause(0)
    connection.deliver(msg)
  })

  channel.addPeer()

  return connection
}
