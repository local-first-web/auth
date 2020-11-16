import { asymmetric } from '@herbcaudill/crypto'
import { ConnectionService } from '/connection'
import { redactDevice } from '/device'
import * as identity from '/identity'
import { acceptMemberInvitation } from '/invitation'
import { KeyType, randomKey, redactKeys } from '/keyset'
import {
  AcceptIdentityMessage,
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  HelloMessage,
  ProveIdentityMessage,
} from '/message'
import { redactUser } from '/user'
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
import '/util/testing/expect/toBeValid'

const alicesLaptop = redactDevice(_alicesLaptop)
const bobsLaptop = redactDevice(_bobsLaptop)
const charliesLaptop = redactDevice(_charliesLaptop)

// used for tests of the connection's timeout - needs to be bigger than
// the TIMEOUT_DELAY constant in connectionMachine, plus some slack
const LONG_TIMEOUT = 10000

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

    const channel = new TestChannel()
    const connect = joinTestChannel(channel)

    return { aliceTeam, bobTeam, sendMessage, lastMessage, connect }
  }

  describe('between members', () => {
    // Test one side of the verification workflow, using a real ConnectionService for Alice
    //  and manually simulating Bob's messages.
    it(`should successfully verify the other peer's identity`, async () => {
      const { aliceTeam: team, sendMessage, lastMessage } = setup()

      const aliceContext = { team, user: alice, device: alicesLaptop }
      // 👩🏾 Alice connects
      const aliceConnection = new ConnectionService({ sendMessage, context: aliceContext }).start()
      const aliceState = () => aliceConnection.state as any

      // 👨‍🦲 Bob sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
      aliceConnection.deliver({
        type: 'HELLO',
        payload: { identityClaim },
      })

      // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
      expect(aliceState().authenticating.verifyingIdentity).toEqual('awaitingIdentityProof')

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
      expect(aliceState().authenticating.verifyingIdentity).toEqual('done')
    })

    // Test the other side, using a real ConnectionService for Bob
    //  and manually simulating Alice's messages.
    it(`should successfully prove our identity to the other peer`, async () => {
      const { bobTeam, sendMessage, lastMessage } = setup()

      // 👨‍🦲 Bob connects
      const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
      const bobConnection = new ConnectionService({ sendMessage, context: bobContext }).start()

      const bobState = () => bobConnection.state as any

      // 👩🏾 Alice sends a hello message
      bobConnection.deliver({
        type: 'HELLO',
        payload: {
          identityClaim: { type: KeyType.MEMBER, name: 'alice' },
        },
      })

      // 👨‍🦲 Bob automatically asserts his identity, and awaits a challenge
      expect(bobState().authenticating.claimingIdentity).toEqual('awaitingIdentityChallenge')

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
      expect(bobState().authenticating.claimingIdentity).toEqual('awaitingIdentityAcceptance')

      // 👩🏾 Alice verifies Bob's proof
      const proofMessage = lastMessage() as ProveIdentityMessage
      const { proof } = proofMessage.payload
      const peerKeys = redactKeys(bob.keys)
      const validation = identity.verify(challenge, proof, peerKeys)
      expect(validation).toBeValid()

      // 👩🏾 Alice generates a acceptance message and sends it to Bob
      const seed = randomKey()
      const encryptedSeed = asymmetric.encrypt({
        secret: seed,
        recipientPublicKey: peerKeys.encryption,
        senderSecretKey: alice.keys.encryption.secretKey,
      })

      const acceptanceMessage: AcceptIdentityMessage = {
        type: 'ACCEPT_IDENTITY',
        payload: { encryptedSeed },
      }
      bobConnection.deliver(acceptanceMessage)

      // ✅ Success! Bob has proved his identity
      expect(bobState().authenticating.claimingIdentity).toEqual('done')
    })

    // Create real ConnectionServices on both sides and let them work it out automatically
    it('should automatically connect two members', async () => {
      const { aliceTeam, bobTeam, connect } = setup()

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      const aliceConnection = connect('alice', {
        team: aliceTeam,
        user: alice,
        device: alicesLaptop,
      })
      const bobConnection = connect('bob', { team: bobTeam, user: bob, device: bobsLaptop })

      await expectConnectionToSucceed([aliceConnection, bobConnection])
    })

    it(`shouldn't connect with a member who has been removed`, async () => {
      const { aliceTeam, bobTeam, connect } = setup()

      // 👩🏾 Alice removes Bob
      aliceTeam.remove('bob')

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      const aliceConnection = connect('alice', aliceContext)
      const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
      const bobConnection = connect('bob', bobContext)

      // ❌ The connection fails
      await expectConnectionToFail([aliceConnection, bobConnection])
    })

    it(`shouldn't connect with someone who doesn't belong to the team`, async () => {
      const { aliceTeam, connect } = setup()

      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      const aliceConnection = connect('alice', aliceContext)
      const charlieContext = { team: aliceTeam, user: charlie, device: charliesLaptop }
      const charlieConnection = connect('charlie', charlieContext)

      // ❌ The connection fails
      await expectConnectionToFail([aliceConnection, charlieConnection])
    })

    it(
      'disconnects if the peer stops responding',
      async () => {
        const { aliceTeam: team, sendMessage } = setup()

        const aliceContext = { team, user: alice, device: alicesLaptop }
        // 👩🏾 Alice connects
        const aliceConnection = new ConnectionService({
          sendMessage,
          context: aliceContext,
        }).start()
        const connectionState = () => aliceConnection.state as any

        // 👨‍🦲 Bob sends a hello message
        const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
        aliceConnection.deliver({
          type: 'HELLO',
          payload: { identityClaim },
        })

        // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
        expect(connectionState().authenticating.verifyingIdentity).toEqual('awaitingIdentityProof')

        // 👨‍🦲 Bob doesn't respond
        // ...
        // ...
        // ...

        // ❌ The connection fails
        await expectConnectionToFail([aliceConnection], 'timed out')
      },
      LONG_TIMEOUT
    )
  })

  describe('with invitation', () => {
    // Test one side of the verification workflow with Bob presenting an invitation, using a real
    // ConnectionService for Alice and manually simulating Bob's messages.
    it(`should successfully verify the other peer's invitation`, async () => {
      const { aliceTeam: team, sendMessage, lastMessage } = setup()

      const aliceContext = { team, user: alice, device: alicesLaptop }

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: invitationSecretKey } = team.invite('bob')

      // 👩🏾 Alice connects
      const aliceConnection = new ConnectionService({ sendMessage, context: aliceContext }).start()
      const aliceState = () => aliceConnection.state as any

      // 👨‍🦲 Bob sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
      const proofOfInvitation = acceptMemberInvitation(invitationSecretKey, redactUser(bob))
      aliceConnection.deliver({
        type: 'HELLO',
        payload: { identityClaim, proofOfInvitation },
      })

      // 👩🏾 Alice automatically validates the invitation
      expect(aliceState().authenticating.verifyingIdentity).toEqual('awaitingIdentityProof')

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
      expect(aliceState().authenticating.verifyingIdentity).toEqual('done')
    })

    // Test the other side with Bob presenting an invitation, using a real ConnectionService for Bob
    //  and manually simulating Alice's messages.
    it(`should successfully present an invitation to the other peer`, async () => {
      const { aliceTeam: team, sendMessage, lastMessage } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: invitationSecretKey } = team.invite('bob')

      // 👨‍🦲 Bob connects
      const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
      const bobConnection = new ConnectionService({ sendMessage, context: bobContext }).start()

      const bobState = () => bobConnection.state as any
      const helloMessage = lastMessage() as HelloMessage

      // 👩🏾 Alice sends a hello message
      bobConnection.deliver({
        type: 'HELLO',
        payload: { identityClaim: { type: KeyType.MEMBER, name: 'alice' } },
      })

      // 👨‍🦲 Bob awaits acceptance
      expect(bobState()).toEqual('awaitingInvitationAcceptance')

      // 👩🏾 Alice validates Bob's invitation
      const { proofOfInvitation } = helloMessage.payload
      team.admit(proofOfInvitation!)

      const chain = team.save()
      const welcomeMessage: AcceptInvitationMessage = {
        type: 'ACCEPT_INVITATION',
        payload: { chain },
      }
      bobConnection.deliver(welcomeMessage)

      // 👩🏾 Alice challenges Bob's identity claim
      const { identityClaim } = helloMessage.payload
      const challenge = identity.challenge(identityClaim)
      const challengeMessage: ChallengeIdentityMessage = {
        type: 'CHALLENGE_IDENTITY',
        payload: { challenge },
      }
      bobConnection.deliver(challengeMessage)

      // 👨‍🦲 Bob automatically responds to the challenge with proof, and awaits acceptance
      expect(bobState().authenticating.claimingIdentity).toEqual('awaitingIdentityAcceptance')

      // 👩🏾 Alice verifies Bob's proof
      const proofMessage = lastMessage() as ProveIdentityMessage
      const { proof } = proofMessage.payload
      const peerKeys = redactKeys(bob.keys)
      const validation = identity.verify(challenge, proof, peerKeys)
      expect(validation).toBeValid()

      // 👩🏾 Alice generates a acceptance message and sends it to Bob
      const seed = randomKey()
      const userKeys = alice.keys
      const encryptedSeed = asymmetric.encrypt({
        secret: seed,
        recipientPublicKey: peerKeys.encryption,
        senderSecretKey: userKeys.encryption.secretKey,
      })

      const acceptanceMessage: AcceptIdentityMessage = {
        type: 'ACCEPT_IDENTITY',
        payload: { encryptedSeed },
      }
      bobConnection.deliver(acceptanceMessage)

      // ✅ Success! Bob has proved his identity
      expect(bobState().authenticating.claimingIdentity).toEqual('done')
    })

    // Create real ConnectionServices with a member on one side and an invitee on the other
    it('should automatically connect an invitee with a member', async () => {
      const { aliceTeam, connect } = setup()

      // Alice is a member
      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      const aliceConnection = connect('alice', aliceContext)

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: invitationSecretKey } = aliceTeam.invite('bob')

      // 👨‍🦲 Bob uses the invitation secret key to connect with Alice
      const bobConnection = connect('bob', { user: bob, device: bobsLaptop, invitationSecretKey })

      // Wait for them both to connect
      await connectionEvent([bobConnection, aliceConnection], 'connected')

      // ✅ They're both connected
      expect(aliceConnection.state).toEqual('connected')
      expect(bobConnection.state).toEqual('connected')

      // ✅ They've converged on a shared secret key
      const aliceKey = aliceConnection.context.sessionKey
      const bobKey = bobConnection.context.sessionKey
      expect(aliceKey).toEqual(bobKey)
    })

    it(`two invitees can't connect`, async () => {
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

      // ❌ The connection fails
      await expectConnectionToFail([bobConnection, charlieConnection], `Can't connect`)
    })
  })
})

const connectionEvent = (connections: ConnectionService[], event: string) =>
  Promise.all(connections.map(c => new Promise(resolve => c.on(event, () => resolve()))))

const expectConnectionToSucceed = async (connections: ConnectionService[]) => {
  // ✅ They're both connected
  await connectionEvent(connections, 'connected')

  const firstKey = connections[0].context.sessionKey
  connections.forEach(connection => {
    expect(connection.state).toEqual('connected')
    // ✅ They've converged on a shared secret key
    expect(connection.context.sessionKey).toEqual(firstKey)
  })
}

const expectConnectionToFail = async (connections: ConnectionService[], message?: string) => {
  // ✅ They're both disconnected
  await connectionEvent(connections, 'disconnected')
  connections.forEach(connection => {
    expect(connection.state).toEqual('disconnected')
    // ✅ If we're checking for a message, it matches
    if (message !== undefined) expect(connection.context.error!.message).toContain(message)
  })
}
