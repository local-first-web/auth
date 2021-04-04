import { Connection, InitialContext, SendFunction } from '@/connection'
import { getDeviceId } from '@/device'
import { pause } from './pause'
import { TestChannel } from './TestChannel'

export const joinTestChannel = (channel: TestChannel) => (context: InitialContext) => {
  const id = getDeviceId(context.device)

  // hook up send
  const sendMessage: SendFunction = msg => channel.write(id, msg)

  // Instantiate the connection service
  const connection = new Connection({ sendMessage, context, peerUserName: context.device.userName })

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
