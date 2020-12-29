import { TestChannel } from '/util/testing/TestChannel'
import { ConnectionContext, Protocol, SendFunction } from '/connection'
import { pause } from '/util/pause'
import { getDeviceId } from '/device'

export const joinTestChannel = (channel: TestChannel) => (context: ConnectionContext) => {
  const { userName, device } = context.user
  const { deviceName } = device
  const id = getDeviceId({ userName, deviceName })

  // hook up send
  const sendMessage: SendFunction = (msg) => channel.write(id, msg)

  // Instantiate the connection service
  const connection = new Protocol({ sendMessage, context })

  // hook up receive
  channel.addListener('data', async (senderId, msg) => {
    if (senderId === id) return // I can ignore messages that I sent

    // simulate a random delay, then deliver the message
    const delay = 1 //Math.floor(Math.random() * 100)
    await pause(delay)
    connection.deliver(msg)
  })

  channel.addPeer()

  return connection
}
