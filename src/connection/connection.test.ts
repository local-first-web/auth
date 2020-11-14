import { ConnectionService } from '/connection'
import { redactDevice } from '/device'
import { KeyType, randomKey, redactKeys } from '/keyset'
import {
  AcceptIdentityMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  HelloMessage,
  ProveIdentityMessage,
} from '/message'
import {
  alice,
  alicesLaptop as _alicesLaptop,
  bob,
  bobsContext,
  bobsLaptop as _bobsLaptop,
  charlie,
  charliesLaptop as _charliesLaptop,
  joinTestChannel,
  newTeam,
  storage,
  TestChannel,
} from '/util/testing'
import * as identity from '/identity'
import '/util/testing/expect/toBeValid'
import { pause } from './pause'

const alicesLaptop = redactDevice(_alicesLaptop)
const bobsLaptop = redactDevice(_bobsLaptop)
const charliesLaptop = redactDevice(_charliesLaptop)

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

  /** Test one side of the verification workflow, using a real ConnectionService for Alice
   *  and manually simulating Bob's responses.
   */
  it(`should successfully verify the other peer's identity`, async () => {
    const { aliceTeam: team, sendMessage, lastMessage } = setup()

    const aliceContext = { team, user: alice, device: alicesLaptop }
    // 👩🏾 Alice connects
    const aliceConnection = new ConnectionService({ sendMessage, context: aliceContext }).start()
    const connectionState = () => aliceConnection.state as any

    // 👨‍🦲 Bob sends a hello message
    const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
    aliceConnection.deliver({
      type: 'HELLO',
      payload: { identityClaim: identityClaim },
    })

    // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
    expect(connectionState().authenticating.verifyingIdentity).toEqual('challengingIdentityClaim')
    await pause(1)
    expect(connectionState().authenticating.verifyingIdentity).toEqual('awaitingIdentityProof')

    // 👨‍🦲 Bob generates proof by signing Alice's challenge and sends it back
    const challengeMessage = lastMessage() as ChallengeIdentityMessage
    const { challenge } = challengeMessage.payload
    const proof = identity.prove(challenge, bob.keys)
    const proofMessage: ProveIdentityMessage = {
      type: 'PROVE_IDENTITY',
      payload: { challenge, proof },
    }
    aliceConnection.deliver(proofMessage)

    // ✅ Success! Alice has verified Bob's identity
    expect(connectionState().authenticating.verifyingIdentity).toEqual('success')
  })

  /** Test the other side, using a real ConnectionService for Bob
   *  and manually simulating Alice's responses
   */
  it(`should successfully prove our identity to the other peer`, async () => {
    const { bobTeam, sendMessage, lastMessage } = setup()

    // 👨‍🦲 Bob connects
    const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
    const bobConnection = new ConnectionService({ sendMessage, context: bobContext }).start()

    const connectionState = () => bobConnection.state as any

    // 👩🏾 Alice sends a hello message
    bobConnection.deliver({
      type: 'HELLO',
      payload: {
        identityClaim: { type: KeyType.MEMBER, name: 'alice' },
      },
    })

    // 👨‍🦲 Bob automatically asserts his identity, and awaits a challenge
    expect(connectionState().authenticating.claimingIdentity).toEqual('awaitingIdentityChallenge')

    // 👩🏾 Alice challenges Bob's identity claim
    const helloMessage = lastMessage() as HelloMessage
    const { identityClaim } = helloMessage.payload
    const challenge = identity.challenge(identityClaim)
    const challengeMessage: ChallengeIdentityMessage = {
      type: 'CHALLENGE_IDENTITY',
      payload: { challenge },
    }
    bobConnection.deliver(challengeMessage)

    // 👨‍🦲 Bob automatically responds to the challenge with proof, and awaits acceptance
    expect(connectionState().authenticating.claimingIdentity).toEqual('awaitingIdentityAcceptance')

    // 👩🏾 Alice verifies Bob's proof
    const proofMessage = lastMessage() as ProveIdentityMessage
    const { proof } = proofMessage.payload
    const peerKeys = redactKeys(bob.keys)
    const validation = identity.verify(challenge, proof, peerKeys)
    expect(validation).toBeValid()

    // 👩🏾 Alice generates a acceptance message and sends it to Bob
    const seed = randomKey()
    const userKeys = alice.keys
    const encryptedSeed = identity.accept({ seed, peerKeys, userKeys })
    const acceptanceMessage: AcceptIdentityMessage = {
      type: 'ACCEPT_IDENTITY',
      payload: { encryptedSeed },
    }
    bobConnection.deliver(acceptanceMessage)

    // ✅ Success! Bob has proved his identity
    expect(connectionState().authenticating.claimingIdentity).toEqual('success')
  })

  /** Create real ConnectionServices on both sides and let them work it out automatically  */
  test('should automatically connect two members', async () => {
    const { aliceTeam, bobTeam, connect } = setup()

    // 👩🏾 👨‍🦲 Alice and Bob both join the channel
    const aliceConnection = connect('alice', { team: aliceTeam, user: alice, device: alicesLaptop })
    const bobConnection = connect('bob', { team: bobTeam, user: bob, device: bobsLaptop })

    // Wait for them both to connect
    await both([bobConnection, aliceConnection], 'connected')

    // ✅ They're both connected
    expect(aliceConnection.state).toEqual('connected')
    expect(bobConnection.state).toEqual('connected')

    // ✅ They've converged on a shared secret key
    const aliceKey = aliceConnection.context.secretKey
    const bobKey = bobConnection.context.secretKey
    expect(aliceKey).toEqual(bobKey)
  })

  /** Create real ConnectionServices with a member on one side and an invitee on the other */
  test('should automatically connect an invitee with a member', async () => {
    const { aliceTeam, connect } = setup()

    // Alice is a member
    const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
    const aliceConnection = connect('alice', aliceContext)

    // 👩🏾 Alice invites 👨‍🦲 Bob
    const { secretKey: invitationSecretKey } = aliceTeam.invite('bob')

    // 👨‍🦲 Bob uses the invitation secret key to connect with Alice
    const bobConnection = connect('bob', { user: bob, device: bobsLaptop, invitationSecretKey })

    // Wait for them both to connect
    await both([bobConnection, aliceConnection], 'connected')

    // ✅ They're both connected
    expect(aliceConnection.state).toEqual('connected')
    expect(bobConnection.state).toEqual('connected')

    // ✅ They've converged on a shared secret key
    const aliceKey = aliceConnection.context.secretKey
    const bobKey = bobConnection.context.secretKey
    expect(aliceKey).toEqual(bobKey)
  })

  /** Create real ConnectionServices with invitees on both sides (expected to fail) */
  test(`two invitees can't connect`, async () => {
    const { aliceTeam, connect } = setup()

    // 👩🏾 Alice invites 👨‍🦲 Bob
    const { secretKey: bobKey } = aliceTeam.invite('bob')
    // 👩🏾 Alice invites 👳‍♂️ Charlie
    const { secretKey: charlieKey } = aliceTeam.invite('charlie')

    // 👨‍🦲 Bob uses his invitation secret key to try to connect
    const bobCtx = { user: bob, device: bobsLaptop, invitationSecretKey: bobKey }
    const bobConnection = connect('bob', bobCtx)

    // 👳‍♂️ Charlie does the same
    const charlieCtx = { user: charlie, device: charliesLaptop, invitationSecretKey: charlieKey }
    const charlieConnection = connect('charlie', charlieCtx)

    // ❌ Wait for them both to fail
    await both([bobConnection, charlieConnection], 'error')

    // ❌ They're both disconnected
    expect(charlieConnection.state).toEqual('disconnected')
    expect(bobConnection.state).toEqual('disconnected')
  })
})

const both = (connections: ConnectionService[], event: string) =>
  Promise.all(connections.map(c => new Promise(resolve => c.on(event, () => resolve()))))
