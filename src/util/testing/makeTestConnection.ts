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
  const connectionService = new ConnectionService({ sendMessage, context })
  const connection = connectionService.start()

  // hook up receive
  channel.addListener('data', async (senderId, msg) => {
    if (senderId === id) return // I can ignore messages that I sent
    // yield, then deliver message
    await pause(0)
    connection.send(msg)
  })

  channel.addPeer()

  return connectionService
}
