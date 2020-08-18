import { TestChannel } from './TestChannel'
import { ConnectionContext, ConnectionEvent, ConnectionService } from '/connection'

export const joinTestChannel = (channel: TestChannel) => (
  id: string,
  context: ConnectionContext
) => {
  // hook up send
  const sendMessage = (msg: ConnectionEvent) => channel.write(id, msg)

  // Instantiate the connection service
  const connection = new ConnectionService({ ...context, sendMessage }).start()

  // hook up receive
  channel.addListener('data', (senderId, msg) => {
    if (senderId === id) return // I can ignore messages that I sent
    connection.send(msg)
  })

  channel.addPeer()

  return connection
}
