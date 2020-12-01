import { pause } from './util'
import { expectConnection } from './util/testing/expectConnection'
import { Connection } from '/connection'
import { ConnectionMessage } from '/connection/message'
import { LocalUserContext } from '/context'
import { redactDevice } from '/device'
import { ADMIN } from '/role'
import * as teams from '/team'
import { User } from '/user'
import { arrayToMap } from '/util/arrayToMap'
import { alice, bob, charlie, joinTestChannel, TestChannel } from '/util/testing'
import '/util/testing/expect/toBeValid'

describe('integration tests', () => {
  // used for tests of the connection's timeout - needs to be bigger than
  // the TIMEOUT_DELAY constant in connectionMachine, plus some slack
  const LONG_TIMEOUT = 10000

  const oneWay = true
  const setup = (userNames: string[] = [], isOneWay = false) => {
    const allTestUsers: Record<string, User> = { alice, bob, charlie }
    const getUserContext = (userName: string): LocalUserContext => {
      const user = allTestUsers[userName]
      return { user }
    }

    // Our dummy `sendMessage` just pushes messages onto a queue. We use this for one-sided tests
    // (where there's only a real connection on one side)
    const messageQueue: ConnectionMessage[] = []
    const sendMessage = (message: ConnectionMessage) => messageQueue.push(message)
    const lastMessage = () => messageQueue[messageQueue.length - 1]

    // For real two-way connections, we use this
    const join = joinTestChannel(new TestChannel())

    // Create a new team
    const sourceTeam = teams.create('Spies Я Us', getUserContext('alice'))

    //  Always add Bob as an admin
    sourceTeam.add(bob, [ADMIN])

    const makeUserStuff = (userName: string) => {
      const user = allTestUsers[userName]
      const context = getUserContext(userName)
      const device = redactDevice(user.device)
      const team = teams.load(sourceTeam.chain, context)
      const connectionContext = { team, user, device }
      const connection = isOneWay
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
        team,
        connectionContext,
        connection,
        getState,
        deliver,
      }
    }

    const testUsers: Record<string, ReturnType<typeof makeUserStuff>> = userNames
      .map(makeUserStuff)
      .reduce(arrayToMap('userName'), {})

    return { sendMessage, join, lastMessage, testUsers }
  }

  describe('integration', () => {
    it('should send updates after connection is established', async () => {
      const { testUsers } = setup(['alice', 'bob'])
      const { alice, bob } = testUsers

      // 👩🏾 Alice and 👨🏻‍🦲 Bob connect
      alice.connection.start()
      bob.connection.start()

      expectConnection([alice.connection, bob.connection])

      // 👩🏾 Alice creates a new role and adds 👨🏻‍🦲 Bob to it
      alice.team.addRole('managers')
      expect(alice.team.hasRole('managers')).toBe(true)

      // 👨🏻‍🦲 Bob sees the new role
      expect(bob.team.hasRole('managers')).toBe(true)
    })

    describe.skip('todo', () => {
      it('should send updates across multiple hops', () => {
        // Alice and Bob connect
        // Bob and Charlie connect
        // Alice creates a new role and adds Bob to it
        // Bob's team now has the new role
        // Charlie's team now has the new role
      })

      it('should resolve concurrent non-conflicting changes when updating', () => {
        // Alice creates a new role and adds Bob to it
        // concurrently, Bob invites Charlie
        // Bob doesn't have the new role
        // Alice doesn't have Bob's invitation for Charlie
        // Alice and Bob connect
        // now Bob does have the new role
        // and Alice does have the invitation
      })

      it('should resolve concurrent duplicate changes when updating', () => {
        // Alice creates a 'managers' role
        // concurrently, Bob creates a 'managers' role
        // Alice and Bob connect
        // the 'managers' role exists
      })

      it('should resolve concurrent duplicate invitations when updating', () => {
        // Alice invites Charlie and Dwight
        // concurrently, Bob invites Charlie and Dwight
        // Alice and Bob connect
        // Charlie connects to Alice and is able to join
        // Dwight connects to Bob and is able to join
      })

      it('should resolve concurrent duplicate removals when updating', () => {
        // Charlie is a member
        // Bob removes Charlie
        // concurrently, Alice removes Charlie
        // Alice and Bob connect
        // Charlie is not a member
      })

      it(`should handle concurrent admittance of the same invitation`, () => {
        // Alice invites Charlie
        // Charlie connects with Alice with his invitation proof
        // Concurrently, Charlie connects with Bob with his invitation proof
        // Alice connects with Bob
        // ?? it all works out?
      })

      it('resolves mutual removes in favor of the senior member', () => {
        // Bob removes Alice
        // concurrently, Alice removes Bob
        // Alice and Bob connect
        // Bob is no longer a member
        // Alice is still a member
        // Their connection is ended
      })

      it(`when a member is demoted and makes concurrent changes, discards those changes`, () => {
        // Alice removes Bob from admins
        // concurrently, Bob creates a new role
        // Alice and Bob connect
        // the new role is gone
      })

      it(`when a member is demoted and concurrently adds a device, the new device is kept`, () => {
        // Alice removes Bob from admins
        // concurrently, Bob invites his phone
        // Bob's phone and laptop connect and the phone joins
        // Alice and Bob connect
        // Bob's phone is still in his devices
      })

      it(`when a member is demoted and concurrently invites a member and the member joins, the new member is removed`, () => {
        // Alice removes Bob from admins
        // concurrently, Bob invites Charlie
        // Bob and Charlie connect
        // Alice and Bob connect
        // Charlie's invitation is gone
      })

      it('resolves mutual demotions in favor of the senior member', () => {
        // Bob removes Alice from admin role
        // concurrently, Alice removes Bob from admin role
        // Alice and Bob connect
        // Bob is no longer an admin
        // Alice is still an admin
        // They are still connected
      })

      it('ends a connection when one participant is removed from the team', () => {
        // Bob and Charlie are members
        // Bob connects with Charlie
        // Alice removes Bob
        // Alice connects with Charlie
        // Charlie's connection with Bob is ended
      })

      it('handles three-way connections', () => {
        // Bob and Charlie are admins
        // Alice and Bob connect
        // Alice and Charlie connect
        // Bob and Charlie connect
        // Alice adds a new role
        // Bob adds a new role
        // Charlie adds a new role
        // All three get the three new roles
      })

      it('resolves concurrent non-conflicting changes in three-way connections', () => {
        // Bob and Charlie are admins
        // Alice and Bob connect
        // Alice and Charlie connect
        // Bob and Charlie connect
        // Alice adds a new role
        // Bob adds a new role
        // Charlie adds a new role
        // All three get the three new roles
      })

      it('resolves concurrent conflicting changes in three-way connections', () => {
        // Bob and Charlie are admins
        // Alice and Bob connect
        // Alice and Charlie connect
        // Bob and Charlie connect
        // Alice adds a new role
        // Bob adds a new role
        // Charlie adds a new role
        // All three get the three new roles
      })

      it(`Eve steals Charlie's only device; Alice heals the team`, () => {
        // Eve steals Charlie's laptop
        // Alice removes the laptop from the team
        // Eve uses Charlie's laptop to try to connect to Bob, but she can't
        // Alice sends Charlie a new invitation; he's able to use it to connect from his phone
      })

      it(`Eve steals one of Charlie's devices; Charlie heals the team`, () => {
        // Charlie invites his phone and it joins
        // Eve steals Charlie's phone
        // From his laptop, Charlie removes the phone from the team
        // Eve uses Charlie's phone to try to connect to Bob, but she can't
      })
    })
  })
})
