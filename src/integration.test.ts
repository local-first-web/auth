import { expectConnection } from './util/testing/expectConnection'
import { Connection } from '/connection'
import { LocalUserContext } from '/context'
import { redactDevice } from '/device'
import { ADMIN } from '/role'
import * as teams from '/team'
import { Team } from '/team'
import { User } from '/user'
import { arrayToMap } from '/util/arrayToMap'
import debug from '/util/debug'
import { alice, bob, charlie, joinTestChannel, TestChannel } from '/util/testing'
import '/util/testing/expect/toBeValid'

const log = debug(`taco`)

beforeAll(() => {
  log.clear()
})

describe('integration', () => {
  beforeEach(() => log.header(testName()))

  const setup = (userNames: string[] = []) => {
    const allTestUsers: Record<string, User> = { alice, bob, charlie }
    const getUserContext = (userName: string): LocalUserContext => {
      const user = allTestUsers[userName]
      return { user }
    }

    // Create a new team
    const sourceTeam = teams.create('Spies Я Us', getUserContext('alice'))

    //  Always add Bob as an admin
    sourceTeam.add(bob, [ADMIN])

    // Create one channel per pair of users
    const pairKey = (a: string, b: string) => [a, b].sort().join(':')

    const channels = {} as Record<string, TestChannel>
    for (const a of userNames) {
      for (const b of userNames) {
        if (a !== b) {
          const pair = pairKey(a, b)
          if (!(pair in channels)) {
            log(`creating test channel ${a} ${b}`)
            channels[pair] = new TestChannel()
          }
        }
      }
    }

    type UserStuff = ReturnType<typeof makeUserStuff>
    const makeUserStuff = (userName: string) => {
      const user = allTestUsers[userName]
      const context = getUserContext(userName)
      const device = redactDevice(user.device)
      const team = teams.load(sourceTeam.chain, context)
      const connectionContext = { team, user, device }
      const userStuff = {
        userName,
        user,
        context,
        device,
        team,
        connectionContext,
        connection: {} as Record<string, Connection>,
        getState: (u: string) => userStuff.connection[u].state,
      }
      return userStuff
    }

    const addConnectionToEachOtherUser = (A: UserStuff) => {
      const a = A.userName
      for (const b of userNames) {
        if (a !== b) {
          const pair = pairKey(a, b)
          const channel = channels[pair]!
          A.connection[b] = joinTestChannel(channel)(A.connectionContext)
        }
      }
      return A
    }

    const testUsers: Record<string, UserStuff> = userNames
      .map(makeUserStuff)
      .map(addConnectionToEachOtherUser)
      .reduce(arrayToMap('userName'), {})

    return { testUsers }
  }

  it('should send updates after connection is established', async () => {
    const { testUsers } = setup(['alice', 'bob'])
    const { alice, bob } = testUsers

    // 👩🏾 👨🏻‍🦲 Alice and Bob connect
    alice.connection['bob'].start()
    bob.connection['alice'].start()
    await expectConnection([alice.connection['bob'], bob.connection['alice']])

    // 👩🏾 Alice creates a new role
    alice.team.addRole('MANAGERS')
    expect(alice.team.hasRole('MANAGERS')).toBe(true)

    // ✅ 👨🏻‍🦲 Bob sees the new role
    await expectConnection([alice.connection['bob'], bob.connection['alice']])
    expect(bob.team.hasRole('MANAGERS')).toBe(true)

    // 👩🏾 Alice creates another new role
    alice.team.addRole('FINANCIAL')
    expect(alice.team.hasRole('FINANCIAL')).toBe(true)

    // ✅ 👨🏻‍🦲 Bob sees the new role
    await expectConnection([alice.connection['bob'], bob.connection['alice']])
    expect(bob.team.hasRole('FINANCIAL')).toBe(true)
  })

  it('should resolve concurrent non-conflicting changes when updating', async () => {
    const { testUsers } = setup(['alice', 'bob'])
    const { alice, bob } = testUsers

    // 👩🏾 Alice creates a new role
    alice.team.addRole('MANAGERS')
    expect(alice.team.hasRole('MANAGERS')).toBe(true)

    // concurrently, Bob invites Charlie
    const { id } = bob.team.invite('charlie')

    // Bob doesn't have the new role
    expect(bob.team.hasRole('MANAGERS')).toBe(false)
    // Alice doesn't have Bob's invitation for Charlie
    expect(alice.team.hasInvitation(id)).toBe(false)

    // 👩🏾 👨🏻‍🦲 Alice and Bob connect
    alice.connection['bob'].start()
    bob.connection['alice'].start()
    await expectConnection([alice.connection['bob'], bob.connection['alice']])

    // now Bob does have the new role
    expect(bob.team.hasRole('MANAGERS')).toBe(true)
    // and Alice does have the invitation
    expect(alice.team.hasInvitation(id)).toBe(true)
  })

  it('should resolve concurrent duplicate changes when updating', async () => {
    const { testUsers } = setup(['alice', 'bob'])
    const { alice, bob } = testUsers

    // 👩🏾 Alice creates a new role
    alice.team.addRole('MANAGERS')
    expect(alice.team.hasRole('MANAGERS')).toBe(true)

    // concurrently, Bob adds the same role
    bob.team.addRole('MANAGERS')
    expect(bob.team.hasRole('MANAGERS')).toBe(true)

    // 👩🏾 👨🏻‍🦲 Alice and Bob connect
    alice.connection['bob'].start()
    bob.connection['alice'].start()
    await expectConnection([alice.connection['bob'], bob.connection['alice']])

    // nothing bad happened, and they both have the role
    expect(alice.team.hasRole('MANAGERS')).toBe(true)
    expect(bob.team.hasRole('MANAGERS')).toBe(true)
  })

  // it('should resolve concurrent duplicate invitations when updating', () => {
  //   // Alice invites Charlie and Dwight
  //   // concurrently, Bob invites Charlie and Dwight
  //   // Alice and Bob connect
  //   // Charlie connects to Alice and is able to join
  //   // Dwight connects to Bob and is able to join
  // })

  it('should resolve concurrent duplicate removals when updating', async () => {
    const { testUsers } = setup(['alice', 'bob', 'charlie'])
    const { alice, bob, charlie } = testUsers

    // add Charlie and sync Alice & Bob up manually
    alice.team.add(charlie.user)
    bob.team = new Team({ source: alice.team.save(), context: bob.context })

    // Charlie is a member
    expect(alice.team.has('charlie')).toBe(true)
    expect(bob.team.has('charlie')).toBe(true)

    // Bob removes Charlie
    bob.team.remove('charlie')

    // concurrently, Alice removes Charlie
    alice.team.remove('charlie')

    // Alice and Bob connect
    alice.connection['bob'].start()
    bob.connection['alice'].start()
    await expectConnection([alice.connection['bob'], bob.connection['alice']])

    // nothing bad happened, and Charlie has been removed on both sides
    expect(alice.team.has('charlie')).toBe(false)
    expect(bob.team.has('charlie')).toBe(false)
  })

  // it(`should handle concurrent admittance of the same invitation`, () => {
  //   // Alice invites Charlie
  //   // Charlie connects with Alice with his invitation proof
  //   // Concurrently, Charlie connects with Bob with his invitation proof
  //   // Alice connects with Bob
  //   // ?? it all works out?
  // })

  // it('resolves mutual removes in favor of the senior member', () => {
  //   // Bob removes Alice
  //   // concurrently, Alice removes Bob
  //   // Alice and Bob connect
  //   // Bob is no longer a member
  //   // Alice is still a member
  //   // Their connection is ended
  // })

  // it(`when a member is demoted and makes concurrent changes, discards those changes`, () => {
  //   // Alice removes Bob from admins
  //   // concurrently, Bob creates a new role
  //   // Alice and Bob connect
  //   // the new role is gone
  // })

  // it(`when a member is demoted and concurrently adds a device, the new device is kept`, () => {
  //   // Alice removes Bob from admins
  //   // concurrently, Bob invites his phone
  //   // Bob's phone and laptop connect and the phone joins
  //   // Alice and Bob connect
  //   // Bob's phone is still in his devices
  // })

  // it(`when a member is demoted and concurrently invites a member and the member joins, the new member is removed`, () => {
  //   // Alice removes Bob from admins
  //   // concurrently, Bob invites Charlie
  //   // Bob and Charlie connect
  //   // Alice and Bob connect
  //   // Charlie's invitation is gone
  // })

  // it('resolves mutual demotions in favor of the senior member', () => {
  //   // Bob removes Alice from admin role
  //   // concurrently, Alice removes Bob from admin role
  //   // Alice and Bob connect
  //   // Bob is no longer an admin
  //   // Alice is still an admin
  //   // They are still connected
  // })

  // it('ends a connection when one participant is removed from the team', () => {
  //   // Bob and Charlie are members
  //   // Bob connects with Charlie
  //   // Alice removes Bob
  //   // Alice connects with Charlie
  //   // Charlie's connection with Bob is ended
  // })

  // it('should send updates across multiple hops', () => {
  //   // Alice and Bob connect
  //   // Bob and Charlie connect
  //   // Alice creates a new role and adds Bob to it
  //   // Bob's team now has the new role
  //   // Charlie's team now has the new role
  // })

  // it('handles three-way connections', () => {
  //   // Bob and Charlie are admins
  //   // Alice and Bob connect
  //   // Alice and Charlie connect
  //   // Bob and Charlie connect
  //   // Alice adds a new role
  //   // Bob adds a new role
  //   // Charlie adds a new role
  //   // All three get the three new roles
  // })

  // it('resolves concurrent non-conflicting changes in three-way connections', () => {
  //   // Bob and Charlie are admins
  //   // Alice and Bob connect
  //   // Alice and Charlie connect
  //   // Bob and Charlie connect
  //   // Alice adds a new role
  //   // Bob adds a new role
  //   // Charlie adds a new role
  //   // All three get the three new roles
  // })

  // it('resolves concurrent conflicting changes in three-way connections', () => {
  //   // Bob and Charlie are admins
  //   // Alice and Bob connect
  //   // Alice and Charlie connect
  //   // Bob and Charlie connect
  //   // Alice adds a new role
  //   // Bob adds a new role
  //   // Charlie adds a new role
  //   // All three get the three new roles
  // })

  // it(`Eve steals Charlie's only device; Alice heals the team`, () => {
  //   // Eve steals Charlie's laptop
  //   // Alice removes the laptop from the team
  //   // Eve uses Charlie's laptop to try to connect to Bob, but she can't
  //   // Alice sends Charlie a new invitation; he's able to use it to connect from his phone
  // })

  // it(`Eve steals one of Charlie's devices; Charlie heals the team`, () => {
  //   // Charlie invites his phone and it joins
  //   // Eve steals Charlie's phone
  //   // From his laptop, Charlie removes the phone from the team
  //   // Eve uses Charlie's phone to try to connect to Bob, but she can't
  // })
})

const testName = () => expect.getState().currentTestName
