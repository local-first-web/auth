import { TestChannel } from './TestChannel'
import { ConnectionContext, ConnectionService } from '/connection'
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
  channel.addListener('data', (senderId, msg) => {
    if (senderId === id) return // I can ignore messages that I sent
    connection.send(msg)
  })

  channel.addPeer()

  return connection
}
