import { asymmetric } from '@herbcaudill/crypto'
import { InitialContext } from './types'
import { Protocol } from '/connection'
import * as identity from '/connection/identity'
import {
  ChallengeIdentityMessage,
  ConnectionMessage,
  HelloMessage,
  ProveIdentityMessage,
} from '/connection/message'
import { LocalUserContext } from '/context'
import { DeviceType, redactDevice } from '/device'
import { generateProof } from '/invitation'
import { KeyType, randomKey, redactKeys } from '/keyset'
import { ADMIN } from '/role'
import * as teams from '/team'
import * as users from '/user'
import { User } from '/user'
import { assert } from '/util'
import { arrayToMap } from '/util/arrayToMap'
import { alice, bob, charlie, joinTestChannel, TestChannel } from '/util/testing'
import '/util/testing/expect/toBeValid'
import { expectDisconnection } from '/util/testing/expectConnection'

// used for tests of the connection's timeout - needs to be bigger than
// the TIMEOUT_DELAY constant in connectionMachine, plus some slack
const LONG_TIMEOUT = 10000

// NOTE: These tests are all one-sided: We drive one side of the workflow mannually against a `Connection`
// on the other side. Any tests involving real `Connection` instances on *both* sides are in `integration.test.ts`.

describe('connection', () => {
  describe('between members', () => {
    // Test one side of the verification workflow, using a real connection for Alice and manually simulating Bob's messages.
    it(`should successfully verify the other peer's identity`, async () => {
      const { testUsers, lastMessage } = setup(['alice'])
      const { alice } = testUsers

      const authenticatingState = () => alice.getState().connecting.authenticating

      // 👩🏾 Alice connects
      alice.connection.start()

      // 👨🏻‍🦲 Bob sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
      alice.deliver({ type: 'HELLO', payload: { identityClaim } })

      // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
      expect(authenticatingState().verifying).toEqual('waiting')

      // 👨🏻‍🦲 Bob generates proof by signing Alice's challenge and sends it back
      const challengeMessage = lastMessage() as ChallengeIdentityMessage
      const { challenge } = challengeMessage.payload
      const proof = identity.prove(challenge, bob.keys)
      alice.deliver({ type: 'PROVE_IDENTITY', payload: { challenge, proof } })

      // ✅ Success! Alice has verified Bob's identity
      expect(authenticatingState().verifying).toEqual('done')
    })

    // Test the other side, using a real connection for Bob and manually simulating Alice's messages.
    it(`should successfully prove our identity to the other peer`, async () => {
      const { testUsers, lastMessage } = setup(['alice', 'bob'])
      const { bob } = testUsers
      const bobAuthenticatingState = () => bob.getState().connecting.authenticating

      // 👨🏻‍🦲 Bob connects
      bob.connection.start()

      // 👩🏾 Alice sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'alice' }
      bob.deliver({ type: 'HELLO', payload: { identityClaim } })

      // 👨🏻‍🦲 Bob automatically asserts his identity, and awaits a challenge
      expect(bobAuthenticatingState().proving).toEqual('awaitingChallenge')

      // 👩🏾 Alice challenges Bob's identity claim
      const helloMessage = lastMessage() as HelloMessage
      const challenge = identity.challenge(helloMessage.payload.identityClaim)
      bob.deliver({ type: 'CHALLENGE_IDENTITY', payload: { challenge } })

      // 👨🏻‍🦲 Bob automatically responds to the challenge with proof, and awaits acceptance
      expect(bobAuthenticatingState().proving).toEqual('awaitingAcceptance')

      // 👩🏾 Alice verifies Bob's proof
      const proofMessage = lastMessage() as ProveIdentityMessage
      const peerKeys = redactKeys(bob.user.keys)
      const validation = identity.verify(challenge, proofMessage.payload.proof, peerKeys)
      expect(validation).toBeValid()

      // 👩🏾 Alice generates a acceptance message and sends it to Bob
      const encryptedSeed = asymmetric.encrypt({
        secret: randomKey(),
        recipientPublicKey: peerKeys.encryption,
        senderSecretKey: alice.keys.encryption.secretKey,
      })
      bob.deliver({ type: 'ACCEPT_IDENTITY', payload: { encryptedSeed } })

      // ✅ Success! Bob has proved his identity
      expect(bobAuthenticatingState().proving).toEqual('done')
    })

    it(
      'disconnects if the peer stops responding',
      async () => {
        const { testUsers } = setup(['alice', 'bob'])
        const { alice } = testUsers

        // 👩🏾 Alice connects
        alice.connection.start()

        // 👨🏻‍🦲 Bob sends a hello message
        const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
        alice.connection.deliver({
          index: 0,
          type: 'HELLO',
          payload: { identityClaim },
        })

        // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
        expect(alice.getState().connecting.authenticating.verifying).toEqual('waiting')

        // 👨🏻‍🦲 Bob doesn't respond
        // ...
        // ...
        // ...

        // ❌ The connection fails
        await expectDisconnection([alice.connection], 'timed out')
      },
      LONG_TIMEOUT
    )
  })

  describe('with invitation', () => {
    // Test one side of the verification workflow with Charlie presenting an invitation, using a real
    // connection for Alice and manually simulating Charlie's messages.
    it(`should successfully verify the other peer's invitation`, async () => {
      const { testUsers } = setup(['alice'])
      const { alice } = testUsers
      const aliceAuthenticatingState = () => alice.getState().connecting.authenticating

      // 👩🏾 Alice invites 👳🏽‍♂️ Charlie
      const { invitationSeed } = alice.team.invite('charlie')

      // 👩🏾 Alice connects
      alice.connection.start()

      // 👳🏽‍♂️ Charlie sends a hello message including the proof of invitation
      const identityClaim = { type: KeyType.MEMBER, name: 'charlie' }
      const proofOfInvitation = generateProof(invitationSeed, 'charlie')
      alice.deliver({ type: 'HELLO', payload: { identityClaim, proofOfInvitation } })

      // ✅ Success! Alice has verified Charlie's identity
      expect(aliceAuthenticatingState().verifying).toEqual('done')
    })

    // Test the other side with Charlie presenting an invitation, using a real connection for Bob
    // and manually simulating Alice's messages.
    it(`should successfully present an invitation to the other peer`, async () => {
      const { testUsers, lastMessage, sendMessage } = setup(['alice'])
      const { alice } = testUsers

      // 👩🏾 Alice invites 👳🏽‍♂️ Charlie

      const { invitationSeed } = alice.team.invite('charlie')

      // 👳🏽‍♂️ Charlie connects
      const charlieContext = {
        user: charlie,
        device: redactDevice(charlie.device),
        invitationSeed,
      } as InitialContext
      const charlieConnection = new Protocol({
        sendMessage,
        context: charlieContext,
      }).start()

      // 👩🏾 Alice sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'alice' }
      charlieConnection.deliver({ index: 0, type: 'HELLO', payload: { identityClaim } })

      // 👳🏽‍♂️ Charlie awaits acceptance
      const charlieState = () => (charlieConnection.state as any).connecting
      expect(charlieState().invitation).toEqual('waiting')

      // 👩🏾 Alice validates Charlie's invitation
      const helloMessage = lastMessage() as HelloMessage
      const { proofOfInvitation } = helloMessage.payload

      console.log(helloMessage)
      assert(proofOfInvitation !== undefined)

      alice.team.admit(proofOfInvitation)
      const chain = alice.team.save()
      charlieConnection.deliver({ index: 1, type: 'ACCEPT_INVITATION', payload: { chain } })

      // 👩🏾 Alice generates an acceptance message and sends it to charlie
      charlieConnection.deliver({ index: 3, type: 'ACCEPT_IDENTITY', payload: {} })

      // ✅ Success! Charlie has proved his identity
      expect(charlieState().authenticating.proving).toEqual('done')
    })

    // In which Eve tries to get Charlie to join her team instead of Alice's
    it(`shouldn't be fooled into joining the wrong team`, async () => {
      const { testUsers, sendMessage } = setup(['alice'])
      const { alice } = testUsers

      // 👩🏾 Alice invites 👳🏽‍♂️ Charlie
      const { invitationSeed } = alice.team.invite('charlie')

      // 🦹‍♀️ Eve is going to impersonate Alice to try to get Charlie to join her team instead
      const fakeAlice = users.create({
        userName: 'alice',
        deviceName: 'laptop',
        deviceType: DeviceType.laptop,
      })
      const eveContext = { user: fakeAlice, device: alice.device }
      const eveTeam = teams.create('Spies Я Us', eveContext)

      // 🦹‍♀️ Eve creates an bogus invitation for Charlie in her signature chain
      eveTeam.invite('charlie')

      // 👳🏽‍♂️ Charlie connects
      const charlieContext = {
        user: charlie,
        device: redactDevice(charlie.device),
        invitationSeed,
      } as InitialContext
      const charlieConnection = new Protocol({ sendMessage, context: charlieContext })
      charlieConnection.start()

      // 🦹‍♀️ Eve sends a hello message pretending to be Alice
      const identityClaim = { type: KeyType.MEMBER, name: 'alice' }
      charlieConnection.deliver({ index: 0, type: 'HELLO', payload: { identityClaim } })

      //  👳🏽‍♂️ Charlie is waiting for fake Alice to accept his invitation
      const charlieState = () => charlieConnection.state as any
      expect(charlieState().connecting.invitation).toEqual('waiting')

      // 🦹‍♀️ Eve pretends to validate Charlie's invitation
      const chain = eveTeam.save()
      charlieConnection.deliver({ index: 1, type: 'ACCEPT_INVITATION', payload: { chain } })

      // 👳🏽‍♂️ Charlie won't see his invitation in Eve's team's sigchain, so he'll bail when he receives the welcome message
      expect(charlieState()).toEqual('disconnected')
      expect(charlieConnection.error!.message).toContain('not the team I was invited to')
    })
  })

  const setup = (userNames: string[] = []) => {
    const allTestUsers: Record<string, User> = { alice, bob, charlie }
    const getUserContext = (userName: string): LocalUserContext => {
      const user = allTestUsers[userName]
      return { user }
    }

    // Our dummy `sendMessage` just pushes messages onto a queue.
    const messageQueue: ConnectionMessage[] = []
    const sendMessage = (message: ConnectionMessage) => messageQueue.push(message)
    const lastMessage = () => messageQueue[messageQueue.length - 1]

    // Create a new team
    const team = teams.create('Spies Я Us', getUserContext('alice'))

    //  Always add Bob as an admin
    team.add(bob, [ADMIN])

    const makeUserStuff = (userName: string) => {
      const user = allTestUsers[userName]
      const context = getUserContext(userName)
      const device = redactDevice(user.device)
      const userTeam = teams.load(team.chain, context)
      const connectionContext = { team: userTeam, user, device }
      const connection = new Protocol({ sendMessage, context: connectionContext })
      const getState = () => connection.state as any

      let index = 0
      const deliver = (msg: ConnectionMessage) => connection.deliver({ index: index++, ...msg })

      return {
        userName,
        user,
        device,
        team: userTeam,
        connection,
        getState,
        deliver,
      }
    }

    const testUsers: Record<string, ReturnType<typeof makeUserStuff>> = userNames
      .map(makeUserStuff)
      .reduce(arrayToMap('userName'), {})

    return { sendMessage, lastMessage, testUsers }
  }
})
