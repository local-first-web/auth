import { asymmetric } from '@herbcaudill/crypto'
import { Connection, ConnectionContext } from '/connection'
import {
  AcceptIdentityMessage,
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  HelloMessage,
  ProveIdentityMessage,
} from '/connection/message'
import { redactDevice } from '/device'
import * as identity from '/identity'
import { acceptMemberInvitation } from '/invitation'
import { KeyType, randomKey, redactKeys } from '/keyset'
import { ADMIN } from '/role'
import * as teams from '/team'
import * as users from '/user'
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
  TestChannel,
} from '/util/testing'
import '/util/testing/expect/toBeValid'

describe('connection', () => {
  const alicesLaptop = redactDevice(_alicesLaptop)
  const bobsLaptop = redactDevice(_bobsLaptop)
  const charliesLaptop = redactDevice(_charliesLaptop)

  // used for tests of the connection's timeout - needs to be bigger than
  // the TIMEOUT_DELAY constant in connectionMachine, plus some slack
  const LONG_TIMEOUT = 10000

  const setup = () => {
    // Create a new team
    const aliceTeam = newTeam()

    // Our dummy `sendMessage` just pushes messages onto a queue
    const messageQueue: ConnectionMessage[] = []
    const sendMessage = (message: ConnectionMessage) => messageQueue.push(message)
    const lastMessage = () => messageQueue[messageQueue.length - 1]

    const connect = (a: ConnectionContext, b: ConnectionContext) => {
      const join = joinTestChannel(new TestChannel())
      const connectionA = join(a)
      const connectionB = join(b)
      return [connectionA, connectionB]
    }

    return { aliceTeam, sendMessage, lastMessage, connect }
  }

  const setupWithBob = () => {
    const { aliceTeam, sendMessage, lastMessage, connect } = setup()

    aliceTeam.add(bob)
    const bobTeam = teams.load(aliceTeam.chain, bobsContext)

    return { aliceTeam, bobTeam, sendMessage, lastMessage, connect }
  }

  describe('between members', () => {
    // Test one side of the verification workflow, using a real connection for Alice and manually simulating Bob's messages.
    it(`should successfully verify the other peer's identity`, async () => {
      const { aliceTeam: team, sendMessage, lastMessage } = setupWithBob()

      const aliceContext = { team, user: alice, device: alicesLaptop }
      // 👩🏾 Alice connects
      const aliceConnection = new Connection({ sendMessage, context: aliceContext }).start()
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

    // Test the other side, using a real connection for Bob and manually simulating Alice's messages.
    it(`should successfully prove our identity to the other peer`, async () => {
      const { bobTeam, sendMessage, lastMessage } = setupWithBob()

      // 👨‍🦲 Bob connects
      const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
      const bobConnection = new Connection({ sendMessage, context: bobContext }).start()

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

    // Let both processes play out automatically
    it('should automatically connect two members', async () => {
      const { aliceTeam, bobTeam, connect } = setupWithBob()

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
      const [aliceConnection, bobConnection] = connect(aliceContext, bobContext)

      await expectConnection([aliceConnection, bobConnection])

      // Alice stops the connection
      aliceConnection.stop()

      // Alice disconnects immediately
      expect(aliceConnection.state).toEqual('disconnected')

      // Bob disconnects shortly thereafter
      await connectionEvent([bobConnection], 'disconnected')
    })

    it(`shouldn't connect with a member who has been removed`, async () => {
      const { aliceTeam, bobTeam, connect } = setupWithBob()

      // 👩🏾 Alice removes Bob
      aliceTeam.remove('bob')

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
      const [aliceConnection, bobConnection] = connect(aliceContext, bobContext)

      // ❌ The connection fails
      await expectDisconnection([aliceConnection, bobConnection])
    })

    it(`shouldn't connect with someone who doesn't belong to the team`, async () => {
      const { aliceTeam, connect } = setupWithBob()

      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      const charlieContext = { team: aliceTeam, user: charlie, device: charliesLaptop }
      const [aliceConnection, charlieConnection] = connect(aliceContext, charlieContext)

      // ❌ The connection fails
      await expectDisconnection([aliceConnection, charlieConnection])
    })

    it(
      'disconnects if the peer stops responding',
      async () => {
        const { aliceTeam: team, sendMessage } = setupWithBob()

        const aliceContext = { team, user: alice, device: alicesLaptop }
        // 👩🏾 Alice connects
        const aliceConnection = new Connection({
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
        await expectDisconnection([aliceConnection], 'timed out')
      },
      LONG_TIMEOUT
    )
  })

  describe('with invitation', () => {
    // Test one side of the verification workflow with Bob presenting an invitation, using a real
    // connection for Alice and manually simulating Bob's messages.
    it(`should successfully verify the other peer's invitation`, async () => {
      const { aliceTeam: team, sendMessage, lastMessage } = setup()

      const aliceContext = { team, user: alice, device: alicesLaptop }

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: invitationSecretKey } = team.invite('bob')

      // 👩🏾 Alice connects
      const aliceConnection = new Connection({ sendMessage, context: aliceContext }).start()
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

    // Test the other side with Bob presenting an invitation, using a real connection for Bob
    //  and manually simulating Alice's messages.
    it(`should successfully present an invitation to the other peer`, async () => {
      const { aliceTeam: team, sendMessage, lastMessage } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: invitationSecretKey } = team.invite('bob')

      // 👨‍🦲 Bob connects
      const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
      const bobConnection = new Connection({ sendMessage, context: bobContext }).start()

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

      const welcomeMessage: AcceptInvitationMessage = {
        type: 'ACCEPT_INVITATION',
        payload: { chain: team.save() },
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

    // Create real connections with a member on one side and an invitee on the other
    it('should automatically connect an invitee with a member', async () => {
      const { aliceTeam, connect } = setup()

      // Alice is a member
      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: invitationSecretKey } = aliceTeam.invite('bob')

      // 👨‍🦲 Bob uses the invitation secret key to connect with Alice
      const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
      const [aliceConnection, bobConnection] = connect(aliceContext, bobContext)

      await expectConnection([bobConnection, aliceConnection])
    })

    // What if someone concurrently presents their invitation to two different members?
    // it.only(`not sure`, async () => {
    //   const { aliceTeam, bobTeam, connect } = setupWithBob()
    //   const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }

    //   // 👩🏾 Alice invites 👨‍🦲 Bob
    //   const { id, secretKey: invitationSecretKey } = aliceTeam.invite('bob')

    //   // 👩🏾 Alice changes her mind and revokes Bob's invitation
    //   aliceTeam.revokeInvitation(id)

    //   // 👨‍🦲 Bob tries to use the invitation
    //   const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
    //   const [aliceConnection, bobConnection] = connect(aliceContext, bobContext)

    //   // ❌ The connection fails
    //   await expectDisconnection([bobConnection, aliceConnection])
    //   expect(aliceConnection.context.error!.message).toContain('revoked')
    // })

    // Two people carrying invitations can't connect to each other - there needs to be at least one
    // current member in a connection in order to let the invitee in.
    it(`shouldn't allow two invitees to connect`, async () => {
      const { aliceTeam, connect } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: bobKey } = aliceTeam.invite('bob')
      // 👩🏾 Alice invites 👳‍♂️ Charlie
      const { secretKey: charlieKey } = aliceTeam.invite('charlie')

      // 👨‍🦲 Bob uses his invitation secret key to try to connect
      const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey: bobKey }

      // 👳‍♂️ Charlie does the same
      const charlieCtx = { user: charlie, device: charliesLaptop, invitationSecretKey: charlieKey }

      const [charlieConnection, bobConnection] = connect(charlieCtx, bobContext)

      // ❌ The connection fails
      await expectDisconnection([bobConnection, charlieConnection], `neither one`)
    })

    // In which Eve tries to get Bob to join her team instead of Alice's
    it(`shouldn't be fooled into joining the wrong team`, async () => {
      const { aliceTeam, sendMessage } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: invitationSecretKey } = aliceTeam.invite('bob')

      // 🦹‍♀️ Eve is going to impersonate Alice to try to get Bob to join her team instead
      const fakeAlice = users.create('alice')
      const eveContext = { user: fakeAlice, device: alicesLaptop }
      const eveTeam = teams.create('Spies Я Us', eveContext)

      // 🦹‍♀️ Eve creates an bogus invitation for Bob
      eveTeam.invite('bob')

      // 👨‍🦲 Bob connects
      const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
      const bobConnection = new Connection({ sendMessage, context: bobContext }).start()

      const bobState = () => bobConnection.state as any

      // 🦹‍♀️ Eve sends a hello message pretending to be Alice
      bobConnection.deliver({
        type: 'HELLO',
        payload: { identityClaim: { type: KeyType.MEMBER, name: 'alice' } },
      })

      // 👨‍🦲 Bob is waiting for fake Alice to accept his invitation
      expect(bobState()).toEqual('awaitingInvitationAcceptance')

      // 🦹‍♀️ Eve pretends to validate Bob's invitation
      const chain = eveTeam.save()
      const welcomeMessage: AcceptInvitationMessage = {
        type: 'ACCEPT_INVITATION',
        payload: { chain },
      }

      // 👨‍🦲 Bob won't see his invitation in Eve's team's sigchain, so he'll bail when he receives the welcome message
      expectDisconnection([bobConnection], 'not the team I was invited to')

      bobConnection.deliver(welcomeMessage)
    })
  })

  // TODO: Figure out what's going on here, these tests fail when the other tests in this file are allowed to run

  describe.only('update', () => {
    it('if they are behind, they will be caught up when they connect', async () => {
      const { aliceTeam, bobTeam, connect } = setupWithBob()

      // at this point, Alice and Bob have the same signature chain

      // 👩🏾 but now Alice does some stuff
      aliceTeam.add(redactUser(charlie))
      aliceTeam.addRole({ roleName: 'managers' })
      aliceTeam.addMemberRole('charlie', 'managers')

      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      // // 👨‍🦲 Bob hasn't connected, so he doesn't have Alice's changes
      // expect(bobTeam.has('charlie')).toBe(false)
      // expect(bobTeam.hasRole('managers')).toBe(false)

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
      const [aConnection, bConnection] = connect(aliceContext, bobContext)

      await expectConnection([aConnection, bConnection])

      // ✅ 👨‍🦲 Bob is up to date with Alice's changes
      expect(bobTeam.has('charlie')).toBe(true)
      expect(bobTeam.hasRole('managers')).toBe(true)
      expect(bobTeam.memberHasRole('charlie', 'managers')).toBe(true)
    })

    it('if we are behind, we will be caught up when we connect', async () => {
      const { aliceTeam, connect } = setupWithBob()
      aliceTeam.addMemberRole('bob', ADMIN)

      const bobTeam = teams.load(aliceTeam.chain, bobsContext)

      // at this point, Alice and Bob have the same signature chain

      // 👨‍🦲 but now Bob does some stuff
      bobTeam.add(redactUser(charlie))
      bobTeam.addRole({ roleName: 'managers' })
      bobTeam.addMemberRole('charlie', 'managers')

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
      const [aConnection, bConnection] = connect(aliceContext, bobContext)

      await expectConnection([aConnection, bConnection])

      // ✅ 👩🏾 Alice is up to date with Bob's changes
      expect(aliceTeam.has('charlie')).toBe(true)
      expect(aliceTeam.hasRole('managers')).toBe(true)
      expect(aliceTeam.memberHasRole('charlie', 'managers')).toBe(true)
    })

    it(`if we've diverged, we will be caught up when we connect`, async () => {
      const { aliceTeam, connect } = setupWithBob()
      aliceTeam.addMemberRole('bob', ADMIN)

      const bobTeam = teams.load(aliceTeam.chain, bobsContext)

      // at this point, Alice and Bob have the same signature chain

      // 👩🏾 but now Alice does some stuff
      aliceTeam.add(redactUser(charlie))
      aliceTeam.addRole({ roleName: 'managers' })
      aliceTeam.addMemberRole('charlie', 'managers')

      // 👨‍🦲 and Bob does some stuff
      bobTeam.addRole({ roleName: 'finance' })
      bobTeam.addMemberRole('alice', 'finance')

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
      const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
      const [aConnection, bConnection] = connect(aliceContext, bobContext)

      await expectConnection([aConnection, bConnection])

      // 👨‍🦲 Bob is up to date with Alice's changes
      expect(bobTeam.has('charlie')).toBe(true)
      expect(bobTeam.hasRole('managers')).toBe(true)
      expect(bobTeam.memberHasRole('charlie', 'managers')).toBe(true)

      // ✅ 👩🏾 and Alice is up to date with Bob's changes
      expect(aliceTeam.hasRole('finance')).toBe(true)
      expect(bobTeam.memberHasRole('alice', 'finance')).toBe(true)
    })
  })

  /** Promisified event */
  const connectionEvent = (connections: Connection[], event: string) =>
    Promise.all(connections.map(c => new Promise(resolve => c.on(event, () => resolve()))))

  const expectConnection = async (connections: Connection[]) => {
    // ✅ They're both connected
    await connectionEvent(connections, 'connected')

    const firstKey = connections[0].context.sessionKey
    connections.forEach(connection => {
      expect(connection.state).toEqual('connected')
      // ✅ They've converged on a shared secret key
      expect(connection.context.sessionKey).toEqual(firstKey)
    })
  }

  const expectDisconnection = async (connections: Connection[], message?: string) => {
    // ✅ They're both disconnected
    await connectionEvent(connections, 'disconnected')
    connections.forEach(connection => {
      expect(connection.state).toEqual('disconnected')
      // ✅ If we're checking for a message, it matches
      if (message !== undefined) expect(connection.context.error!.message).toContain(message)
    })
  }
})
