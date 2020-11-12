import { redactDevice } from '/device'
import { ConnectionMessage } from '/message'
import {
  alice,
  alicesLaptop,
  bob,
  bobsContext,
  bobsLaptop,
  joinTestChannel,
  newTeam,
  storage,
  TestChannel,
} from '/util/testing'
import '/util/testing/expect/toBeValid'

describe('connection', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  const setup = () => {
    // Create a new team and add Bob to it
    const aliceTeam = newTeam()
    aliceTeam.add(bob)

    storage.save(aliceTeam)
    const bobTeam = storage.load(bobsContext)

    // Our dummy `sendMessage` just pushes messages onto a queue
    const messageQueue: ConnectionMessage[] = []
    const sendMessage = (message: ConnectionMessage) => messageQueue.push(message)
    const lastMessage = () => messageQueue[messageQueue.length - 1]

    return { aliceTeam, bobTeam, sendMessage, lastMessage }
  }

  /**
   * Wire up two ConnectionServices and have them talk to each other through a
   * simple channel with no handholding.
   */
  test('should automatically connect two peers', async () => {
    const { aliceTeam, bobTeam } = setup()
    const channel = new TestChannel()
    const connect = joinTestChannel(channel)

    // Alice and Bob both join the channel
    const aliceConnection = connect('alice', {
      team: aliceTeam,
      user: alice,
      device: redactDevice(alicesLaptop),
    })

    const bobConnection = connect('bob', {
      team: bobTeam,
      user: bob,
      device: redactDevice(bobsLaptop),
    })

    // Wait for them both to connect
    const bothConnected = Promise.all([
      new Promise(resolve => aliceConnection.on('connected', () => resolve())),
      new Promise(resolve => bobConnection.on('connected', () => resolve())),
    ])
    await bothConnected

    // They're both connected
    expect(aliceConnection.state).toEqual('connected')
    expect(bobConnection.state).toEqual('connected')

    // They've converged on a shared secret key
    const aliceKey = aliceConnection.context.secretKey
    const bobKey = bobConnection.context.secretKey
    expect(aliceKey).toEqual(bobKey)
  })
})

// aliceConnection.instance.subscribe(logState)
//
// const logState = (state: any) => {
//   console.log('state change', {
//     user: state.context.user.userName,
//     state: state.value,
//     event: state.event.type,
//     actions: state.actions.map((a: any) => a.type),
//   })
// }
