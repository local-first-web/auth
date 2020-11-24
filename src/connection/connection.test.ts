import { asymmetric } from '@herbcaudill/crypto'
import { Connection, ConnectionContext } from '/connection'
import {
  ChallengeIdentityMessage,
  ConnectionMessage,
  HelloMessage,
  ProveIdentityMessage,
} from '/connection/message'
import { LocalUserContext } from '/context'
import { redactDevice } from '/device'
import * as identity from '/identity'
import { acceptMemberInvitation } from '/invitation'
import { KeyType, randomKey, redactKeys } from '/keyset'
import { ADMIN } from '/role'
import * as teams from '/team'
import { Team } from '/team'
import * as users from '/user'
import { redactUser, User } from '/user'
import { pause } from '/util'
import { arrayToMap } from '/util/arrayToMap'
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
  const testUsers = { alice, bob, charlie } as Record<string, User>
  const userContext = (userName: string): LocalUserContext => {
    const user = testUsers[userName]
    return { user }
  }

  // used for tests of the connection's timeout - needs to be bigger than
  // the TIMEOUT_DELAY constant in connectionMachine, plus some slack
  const LONG_TIMEOUT = 10000

  const setup = (userNames: string[] = [], oneWay = false) => {
    // Our dummy `sendMessage` just pushes messages onto a queue. We use this for one-sided tests
    // (where there's only a realy connection on one side)
    const messageQueue: ConnectionMessage[] = []
    const sendMessage = (message: ConnectionMessage) => messageQueue.push(message)
    const lastMessage = () => messageQueue[messageQueue.length - 1]

    // For real two-way connections, we use this
    const join = joinTestChannel(new TestChannel())

    // Create a new team
    const team = teams.create('Spies Я Us', userContext('alice'))
    //  Always add Bob
    team.add(bob)

    const makeUserStuff = (userName: string) => {
      const user = testUsers[userName]
      const context = userContext(userName)
      const device = redactDevice(user.device)
      const userTeam = teams.load(team.chain, context)
      const connectionContext = { team: userTeam, user, device }
      const connection = oneWay
        ? new Connection({ sendMessage, context: connectionContext })
        : join(connectionContext)
      const getState = () => connection.state as any

      let index = 0
      const deliver = (msg: ConnectionMessage) => connection.deliver({ index: index++, ...msg })

      return {
        userName,
        user,
        context,
        device,
        team: userTeam,
        connectionContext,
        connection,
        getState,
        deliver,
      }
    }

    const users: Record<string, ReturnType<typeof makeUserStuff>> = userNames
      .map(makeUserStuff)
      .reduce(arrayToMap('userName'), {})

    return { sendMessage, lastMessage, users }
  }

  describe.only('between members', () => {
    // Test one side of the verification workflow, using a real connection for Alice and manually simulating Bob's messages.
    it(`should successfully verify the other peer's identity`, async () => {
      const oneWay = true
      const { users, lastMessage } = setup(['alice', 'bob'], oneWay)
      const { alice } = users

      const authenticatingState = () => alice.getState().connecting.authenticating

      // 👩🏾 Alice connects
      alice.connection.start()

      // 👨‍🦲 Bob sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
      alice.deliver({ type: 'HELLO', payload: { identityClaim } })

      // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
      expect(authenticatingState().verifyingTheirIdentity).toEqual('awaitingIdentityProof')

      // 👨‍🦲 Bob generates proof by signing Alice's challenge and sends it back
      const challengeMessage = lastMessage() as ChallengeIdentityMessage
      const { challenge } = challengeMessage.payload
      const proof = identity.prove(challenge, bob.keys)
      alice.deliver({ type: 'PROVE_IDENTITY', payload: { challenge, proof } })

      // ✅ Success! Alice has verified Bob's identity
      expect(authenticatingState().verifyingTheirIdentity).toEqual('done')
    })

    // Test the other side, using a real connection for Bob and manually simulating Alice's messages.
    it(`should successfully prove our identity to the other peer`, async () => {
      const oneWay = true
      const { users, lastMessage } = setup(['alice', 'bob'], oneWay)
      const { bob } = users
      const bobAuthenticatingState = () => bob.getState().connecting.authenticating

      // 👨‍🦲 Bob connects
      bob.connection.start()

      // 👩🏾 Alice sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'alice' }
      bob.deliver({ type: 'HELLO', payload: { identityClaim } })

      // 👨‍🦲 Bob automatically asserts his identity, and awaits a challenge
      expect(bobAuthenticatingState().provingOurIdentity).toEqual('awaitingIdentityChallenge')

      // 👩🏾 Alice challenges Bob's identity claim
      const helloMessage = lastMessage() as HelloMessage
      const challenge = identity.challenge(helloMessage.payload.identityClaim)
      bob.deliver({ type: 'CHALLENGE_IDENTITY', payload: { challenge } })

      // 👨‍🦲 Bob automatically responds to the challenge with proof, and awaits acceptance
      expect(bobAuthenticatingState().provingOurIdentity).toEqual('awaitingIdentityAcceptance')

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
      expect(bobAuthenticatingState().provingOurIdentity).toEqual('done')
    })

    // Let both processes play out automatically
    it('should automatically connect two members', async () => {
      const { users } = setup(['alice', 'bob'])
      const { alice, bob } = users

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      alice.connection.start()
      bob.connection.start()

      await expectConnection([alice.connection, bob.connection])

      // Alice stops the connection
      alice.connection.stop()
      expect(alice.connection.state).toEqual('disconnected')
      await expectDisconnection([bob.connection])
    })

    it(`shouldn't connect with a member who has been removed`, async () => {
      const { users } = setup(['alice', 'bob'])
      const { alice, bob } = users

      // 👩🏾 Alice removes Bob
      alice.team.remove('bob')

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      alice.connection.start()
      bob.connection.start()

      // ❌ The connection fails
      await expectDisconnection([alice.connection, bob.connection])
    })

    it(`shouldn't connect with someone who doesn't belong to the team`, async () => {
      const { users } = setup(['alice', 'charlie'])
      const { alice, charlie } = users

      // Alice connects
      alice.connection.start()

      // Charlie tries to connect
      charlie.connection.start()

      // ❌ The connection fails
      await expectDisconnection([alice.connection, charlie.connection])
    })

    // it(
    //   'disconnects if the peer stops responding',
    //   async () => {
    //     const { aliceTeam: team, sendMessage } = setup(['alice', 'bob'])

    //     const aliceContext = { team, user: alice, device: alicesLaptop }
    //     // 👩🏾 Alice connects
    //     const alice.connection = new Connection({
    //       sendMessage,
    //       context: aliceContext,
    //     }).start()
    //     const connectionState = () => alice.connection.state as any

    //     // 👨‍🦲 Bob sends a hello message
    //     const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
    //     alice.connection.deliver({
    //       index: 0,
    //       type: 'HELLO',
    //       payload: { identityClaim },
    //     })

    //     // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
    //     expect(connectionState().connecting.authenticating.verifyingTheirIdentity).toEqual(
    //       'awaitingIdentityProof'
    //     )

    //     // 👨‍🦲 Bob doesn't respond
    //     // ...
    //     // ...
    //     // ...

    //     // ❌ The connection fails
    //     await expectDisconnection([alice.connection], 'timed out')
    //   },
    //   LONG_TIMEOUT
    // )
  })

  // describe('with invitation', () => {
  //   // Test one side of the verification workflow with Bob presenting an invitation, using a real
  //   // connection for Alice and manually simulating Bob's messages.
  //   it(`should successfully verify the other peer's invitation`, async () => {
  //     const { aliceTeam: team, sendMessage, lastMessage } = setup()

  //     const aliceContext = { team, user: alice, device: alicesLaptop }

  //     // 👩🏾 Alice invites 👨‍🦲 Bob
  //     const { secretKey: invitationSecretKey } = team.invite('bob')

  //     // 👩🏾 Alice connects
  //     const alice.connection = new Connection({ sendMessage, context: aliceContext }).start()
  //     const aliceState = () => alice.connection.state as any

  //     // 👨‍🦲 Bob sends a hello message
  //     const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
  //     const proofOfInvitation = acceptMemberInvitation(invitationSecretKey, redactUser(bob))
  //     alice.connection.deliver({
  //       index: 0,
  //       type: 'HELLO',
  //       payload: { identityClaim, proofOfInvitation },
  //     })

  //     // 👩🏾 Alice automatically validates the invitation
  //     expect(aliceState().connecting.authenticating.verifyingTheirIdentity).toEqual(
  //       'awaitingIdentityProof'
  //     )

  //     // 👨‍🦲 Bob generates proof by signing Alice's challenge and sends it back
  //     const challengeMessage = lastMessage() as ChallengeIdentityMessage
  //     const { challenge } = challengeMessage.payload
  //     const proof = identity.prove(challenge, bob.keys)
  //     alice.connection.deliver({
  //       index: 1,
  //       type: 'PROVE_IDENTITY',
  //       payload: { challenge, proof },
  //     })

  //     // ✅ Success! Alice has verified Bob's identity
  //     expect(aliceState().connecting.authenticating.verifyingTheirIdentity).toEqual('done')
  //   })

  //   // Test the other side with Bob presenting an invitation, using a real connection for Bob
  //   //  and manually simulating Alice's messages.
  //   it(`should successfully present an invitation to the other peer`, async () => {
  //     const { aliceTeam: team, sendMessage, lastMessage } = setup()

  //     // 👩🏾 Alice invites 👨‍🦲 Bob
  //     const { secretKey: invitationSecretKey } = team.invite('bob')

  //     // 👨‍🦲 Bob connects
  //     const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
  //     const bob.connection = new Connection({ sendMessage, context: bobContext }).start()

  //     const bob.getState = () => bob.connection.state as any
  //     const helloMessage = lastMessage() as HelloMessage

  //     // 👩🏾 Alice sends a hello message
  //     bob.deliver({
  //       type: 'HELLO',
  //       payload: { identityClaim: { type: KeyType.MEMBER, name: 'alice' } },
  //     })

  //     // 👨‍🦲 Bob awaits acceptance
  //     expect(bob.getState().connecting.maybeHandlingInvitations).toEqual('awaitingInvitationAcceptance')

  //     // 👩🏾 Alice validates Bob's invitation
  //     const { proofOfInvitation } = helloMessage.payload
  //     team.admit(proofOfInvitation!)
  //     bob.deliver({
  //       type: 'ACCEPT_INVITATION',
  //       payload: { chain: team.save() },
  //     })

  //     // 👩🏾 Alice challenges Bob's identity claim
  //     const { identityClaim } = helloMessage.payload
  //     const challenge = identity.challenge(identityClaim)
  //     bob.deliver({
  //       type: 'CHALLENGE_IDENTITY',
  //       payload: { challenge },
  //     })

  //     // 👨‍🦲 Bob automatically responds to the challenge with proof, and awaits acceptance
  //     expect(bob.getState().connecting.authenticating.provingOurIdentity).toEqual(
  //       'awaitingIdentityAcceptance'
  //     )

  //     // 👩🏾 Alice verifies Bob's proof
  //     const proofMessage = lastMessage() as ProveIdentityMessage
  //     const { proof } = proofMessage.payload
  //     const peerKeys = redactKeys(bob.keys)
  //     const validation = identity.verify(challenge, proof, peerKeys)
  //     expect(validation).toBeValid()

  //     // 👩🏾 Alice generates a acceptance message and sends it to Bob
  //     const seed = randomKey()
  //     const userKeys = alice.keys
  //     const encryptedSeed = asymmetric.encrypt({
  //       secret: seed,
  //       recipientPublicKey: peerKeys.encryption,
  //       senderSecretKey: userKeys.encryption.secretKey,
  //     })
  //     bob.deliver({
  //       type: 'ACCEPT_IDENTITY',
  //       payload: { encryptedSeed },
  //     })

  //     // ✅ Success! Bob has proved his identity
  //     expect(bob.getState().connecting.authenticating.provingOurIdentity).toEqual('done')
  //   })

  //   // Create real connections with a member on one side and an invitee on the other
  //   it('should automatically connect an invitee with a member', async () => {
  //     const { aliceTeam, connect } = setup()

  //     // Alice is a member
  //     const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }

  //     // 👩🏾 Alice invites 👨‍🦲 Bob
  //     const { secretKey: invitationSecretKey } = aliceTeam.invite('bob')

  //     // 👨‍🦲 Bob uses the invitation secret key to connect with Alice
  //     const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
  //     const [alice.connection, bob.connection] = connect(aliceContext, bobContext)

  //     await expectConnection([bob.connection, alice.connection])
  //   })

  //   // What if someone concurrently presents their invitation to two different members?
  //   // it(`not sure how this should work`, async () => {
  //   //   const { aliceTeam, bobTeam, connect } = setup(['alice', 'bob'])
  //   //   const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }

  //   //   // 👩🏾 Alice invites 👨‍🦲 Bob
  //   //   const { id, secretKey: invitationSecretKey } = aliceTeam.invite('bob')

  //   //   // 👩🏾 Alice changes her mind and revokes Bob's invitation
  //   //   aliceTeam.revokeInvitation(id)

  //   //   // 👨‍🦲 Bob tries to use the invitation
  //   //   const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
  //   //   const [alice.connection, bob.connection] = connect(aliceContext, bobContext)

  //   //   // ❌ The connection fails
  //   //   await expectDisconnection([bob.connection, alice.connection])
  //   //   expect(alice.connection.context.error!.message).toContain('revoked')
  //   // })

  //   // Two people carrying invitations can't connect to each other - there needs to be at least one
  //   // current member in a connection in order to let the invitee in.
  //   it(`shouldn't allow two invitees to connect`, async () => {
  //     const { aliceTeam, connect } = setup()

  //     // 👩🏾 Alice invites 👨‍🦲 Bob
  //     const { secretKey: bobKey } = aliceTeam.invite('bob')
  //     // 👩🏾 Alice invites 👳‍♂️ Charlie
  //     const { secretKey: charlieKey } = aliceTeam.invite('charlie')

  //     // 👨‍🦲 Bob uses his invitation secret key to try to connect
  //     const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey: bobKey }

  //     // 👳‍♂️ Charlie does the same
  //     const charlieCtx = { user: charlie, device: charliesLaptop, invitationSecretKey: charlieKey }

  //     const [charlieConnection, bob.connection] = connect(charlieCtx, bobContext)

  //     // ❌ The connection fails
  //     await expectDisconnection([bob.connection, charlieConnection], `neither one`)
  //   })

  //   // In which Eve tries to get Bob to join her team instead of Alice's
  //   it(`shouldn't be fooled into joining the wrong team`, async () => {
  //     const { aliceTeam, sendMessage } = setup()

  //     // 👩🏾 Alice invites 👨‍🦲 Bob
  //     const { secretKey: invitationSecretKey } = aliceTeam.invite('bob')

  //     // 🦹‍♀️ Eve is going to impersonate Alice to try to get Bob to join her team instead
  //     const fakeAlice = users.create('alice')
  //     const eveContext = { user: fakeAlice, device: alicesLaptop }
  //     const eveTeam = teams.create('Spies Я Us', eveContext)

  //     // 🦹‍♀️ Eve creates an bogus invitation for Bob
  //     eveTeam.invite('bob')

  //     // 👨‍🦲 Bob connects
  //     const bobContext = { user: bob, device: bobsLaptop, invitationSecretKey }
  //     const bob.connection = new Connection({ sendMessage, context: bobContext }).start()

  //     const bob.getState = () => bob.connection.state as any

  //     // 🦹‍♀️ Eve sends a hello message pretending to be Alice
  //     bob.deliver({
  //       type: 'HELLO',
  //       payload: { identityClaim: { type: KeyType.MEMBER, name: 'alice' } },
  //     })

  //     // 👨‍🦲 Bob is waiting for fake Alice to accept his invitation
  //     expect(bob.getState().connecting.maybeHandlingInvitations).toEqual('awaitingInvitationAcceptance')

  //     // 👨‍🦲 Bob won't see his invitation in Eve's team's sigchain, so he'll bail when he receives the welcome message
  //     expectDisconnection([bob.connection], 'not the team I was invited to')

  //     // 🦹‍♀️ Eve pretends to validate Bob's invitation
  //     const chain = eveTeam.save()
  //     bob.deliver({
  //       type: 'ACCEPT_INVITATION',
  //       payload: { chain },
  //     })
  //   })
  // })

  // describe('update', () => {
  //   it('if they are behind, they will be caught up when they connect', async () => {
  //     const { aliceTeam, bobTeam, connect } = setup(['alice', 'bob'])

  //     // at this point, Alice and Bob have the same signature chain

  //     // 👩🏾 but now Alice does some stuff
  //     aliceTeam.add(redactUser(charlie))
  //     aliceTeam.addRole({ roleName: 'managers' })
  //     aliceTeam.addMemberRole('charlie', 'managers')

  //     const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
  //     // // 👨‍🦲 Bob hasn't connected, so he doesn't have Alice's changes
  //     // expect(bobTeam.has('charlie')).toBe(false)
  //     // expect(bobTeam.hasRole('managers')).toBe(false)

  //     // 👩🏾 👨‍🦲 Alice and Bob both join the channel
  //     const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
  //     const [aConnection, bConnection] = connect(aliceContext, bobContext)

  //     await expectConnection([aConnection, bConnection])

  //     // ✅ 👨‍🦲 Bob is up to date with Alice's changes
  //     expect(bobTeam.has('charlie')).toBe(true)
  //     expect(bobTeam.hasRole('managers')).toBe(true)
  //     expect(bobTeam.memberHasRole('charlie', 'managers')).toBe(true)
  //   })

  //   it('if we are behind, we will be caught up when we connect', async () => {
  //     const { aliceTeam, connect } = setup(['alice', 'bob'])
  //     aliceTeam.addMemberRole('bob', ADMIN)

  //     const bobTeam = teams.load(aliceTeam.chain, bobsContext)

  //     // at this point, Alice and Bob have the same signature chain

  //     // 👨‍🦲 but now Bob does some stuff
  //     bobTeam.add(redactUser(charlie))
  //     bobTeam.addRole({ roleName: 'managers' })
  //     bobTeam.addMemberRole('charlie', 'managers')

  //     // 👩🏾 👨‍🦲 Alice and Bob both join the channel
  //     const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
  //     const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
  //     const [aConnection, bConnection] = connect(aliceContext, bobContext)

  //     await expectConnection([aConnection, bConnection])

  //     // ✅ 👩🏾 Alice is up to date with Bob's changes
  //     expect(aliceTeam.has('charlie')).toBe(true)
  //     expect(aliceTeam.hasRole('managers')).toBe(true)
  //     expect(aliceTeam.memberHasRole('charlie', 'managers')).toBe(true)
  //   })

  //   it(`if we've diverged, we will be caught up when we connect`, async () => {
  //     const { aliceTeam, connect } = setup(['alice', 'bob'])
  //     aliceTeam.addMemberRole('bob', ADMIN)

  //     const bobTeam = teams.load(aliceTeam.chain, bobsContext)

  //     // at this point, Alice and Bob have the same signature chain

  //     // 👩🏾 but now Alice does some stuff
  //     aliceTeam.add(redactUser(charlie))
  //     aliceTeam.addRole({ roleName: 'managers' })
  //     aliceTeam.addMemberRole('charlie', 'managers')

  //     // 👨‍🦲 and Bob does some stuff
  //     bobTeam.addRole({ roleName: 'finance' })
  //     bobTeam.addMemberRole('alice', 'finance')

  //     // 👩🏾 👨‍🦲 Alice and Bob both join the channel
  //     const aliceContext = { team: aliceTeam, user: alice, device: alicesLaptop }
  //     const bobContext = { team: bobTeam, user: bob, device: bobsLaptop }
  //     const [aConnection, bConnection] = connect(aliceContext, bobContext)

  //     await expectConnection([aConnection, bConnection])

  //     // 👨‍🦲 Bob is up to date with Alice's changes
  //     expect(bobTeam.has('charlie')).toBe(true)
  //     expect(bobTeam.hasRole('managers')).toBe(true)
  //     expect(bobTeam.memberHasRole('charlie', 'managers')).toBe(true)

  //     // ✅ 👩🏾 and Alice is up to date with Bob's changes
  //     expect(aliceTeam.hasRole('finance')).toBe(true)
  //     expect(bobTeam.memberHasRole('alice', 'finance')).toBe(true)
  //   })
  // })

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
