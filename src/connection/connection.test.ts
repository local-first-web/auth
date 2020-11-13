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
  beforeAll(() => {
    console.clear()
  })
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

    const channel = new TestChannel()
    const connect = joinTestChannel(channel)

    return { aliceTeam, bobTeam, sendMessage, lastMessage, connect }
  }

  test('should automatically connect two members', async () => {
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

  test.only('should automatically connect an invitee with a member', async () => {
    const { aliceTeam, connect } = setup()

    // Alice is a member
    const aliceConnection = connect('alice', {
      team: aliceTeam,
      user: alice,
      device: redactDevice(alicesLaptop),
    })

    // 👩🏾 Alice invites 👨‍🦲 Bob
    const { secretKey } = aliceTeam.invite('bob')

    // 👨‍🦲 Bob uses the invitation secret key to connect with Alice
    const bobConnection = connect('bob', {
      user: bob,
      device: redactDevice(bobsLaptop),
      invitationSecretKey: secretKey,
    })

    aliceConnection.instance.subscribe(logState)
    bobConnection.instance.subscribe(logState)

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

const logState = (state: any) => {
  console.log('state change', {
    user: state.context.user.userName,
    state: state.value,
    event: state.event.type,
    actions: state.actions.map((a: any) => a.type),
  })
}
