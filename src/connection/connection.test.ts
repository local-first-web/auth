import { pause } from './pause'
import { ConnectionState, MemberConnectionState } from './types'
import { ConnectionService } from '/connection'
import { redactDevice } from '/device'
import * as identity from '/identity'
import { KeyType, randomKey, redact } from '/keyset'
import {
  AcceptIdentityMessage,
  ChallengeIdentityMessage,
  ClaimIdentityMessage,
  ConnectionMessage,
  ProveIdentityMessage,
} from '/message'
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

const { MEMBER } = KeyType

describe.only('connection', () => {
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
   * Test one side of the verification workflow, using a real ConnectionService for Alice
   * and manually simulating Bob's responses.
   */
  it(`should successfully verify the other peer's identity`, async () => {
    const { aliceTeam: team, sendMessage, lastMessage } = setup()

    // Instantiate the connection service
    const aliceConnection = new ConnectionService({
      sendMessage,
      context: {
        team,
        user: alice,
        device: redactDevice(alicesLaptop),
      },
    }).start()
    const connectionState = () => aliceConnection.state.value as any

    // Bob sends a hello message
    aliceConnection.send({ type: 'HELLO', payload: 'I AM A MEMBER' })

    // Alice waits for the other end to claim an identity
    expect(connectionState().authenticating.verifyingIdentity).toEqual('awaitingIdentityClaim')

    // Bob sends a message claiming that he is Bob
    const claimMessage = identity.claim({
      type: MEMBER,
      name: 'bob',
    })
    aliceConnection.send(claimMessage)

    // Alice automatically sends Bob a challenge & waits for proof
    expect(connectionState().authenticating.verifyingIdentity).toEqual('awaitingIdentityProof')

    // Bob generates proof by signing Alice's challenge and sends it back
    const challengeMessage = lastMessage() as ChallengeIdentityMessage
    const proofMessage = identity.prove(challengeMessage, bob.keys)
    aliceConnection.send(proofMessage)

    // Success! Alice has verified Bob's identity
    expect(connectionState().authenticating.verifyingIdentity).toEqual('success')
  })

  /**
   * Test the other side, using a real ConnectionService for Bob
   * and manually simulating Alice's responses
   */
  it(`should successfully prove our identity to the other peer`, async () => {
    const { bobTeam, sendMessage, lastMessage } = setup()

    // Instantiate the connection service
    const bobConnection = new ConnectionService({
      sendMessage,
      context: {
        team: bobTeam,
        user: bob,
        device: redactDevice(bobsLaptop),
      },
    }).start()
    const connectionState = () => bobConnection.state.value as any

    // Alice sends a hello message
    bobConnection.send({ type: 'HELLO', payload: 'I AM A MEMBER' })

    // Bob automatically asserts his identity, and awaits a challenge
    expect(connectionState().authenticating.claimingIdentity).toEqual('awaitingIdentityChallenge')

    // Alice challenges Bob's identity claim
    const claimMessage = lastMessage() as ClaimIdentityMessage
    const challengeMessage = identity.challenge(claimMessage)
    bobConnection.send(challengeMessage)

    // Bob automatically responds to the challenge with proof, and awaits acceptance
    expect(connectionState().authenticating.claimingIdentity).toEqual('awaitingIdentityAcceptance')

    // Alice verifies Bob's proof
    const proofMessage = lastMessage() as ProveIdentityMessage
    const peerKeys = redact(bob.keys)
    const validation = identity.verify(challengeMessage, proofMessage, peerKeys)
    expect(validation).toBeValid()

    // Alice generates a acceptance message and sends it to Bob
    const seed = randomKey()
    const userKeys = alice.keys
    const acceptanceMessage: AcceptIdentityMessage = identity.accept({ seed, peerKeys, userKeys })
    bobConnection.send(acceptanceMessage)

    // Success! Bob has proved his identity
    expect(connectionState().authenticating.claimingIdentity).toEqual('success')
  })

  /**
   * In this test, we wire up two ConnectionServices and have them talk to each other through a
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
