import { getSequence, merge, TeamSignatureChain } from './chain'
import { actionFingerprint } from './chain/actionFingerprint'
import { KeyType } from './keyset'
import { Connection, InitialContext } from '/connection'
import { LocalUserContext } from '/context'
import { DeviceType, DeviceWithSecrets, getDeviceId, PublicDevice, redactDevice } from '/device'
import * as keysets from '/keyset'
import { ADMIN } from '/role'
import * as teams from '/team'
import { Team } from '/team'
import { User } from '/user'
import { arrayToMap, debug } from '/util'
import { alice, bob, charlie, dwight, joinTestChannel, TestChannel } from '/util/testing'
import '/util/testing/expect/toBeValid'

const log = debug(`taco:test`)

beforeAll(() => log.clear())

describe('integration', () => {
  test(`can reconnect after disconnecting`, async () => {
    const { alice, bob } = setup(['alice', 'bob'])
    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // 👩🏾🔌👨🏻‍🦲 Alice and Bob disconnect
    await disconnect(alice, bob)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob reconnect
    await connect(alice, bob)

    // ✅
  })

  test('sends updates after connection is established', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // 👩🏾 Alice creates a new role
    expect(alice.team.hasRole('MANAGERS')).toBe(false)
    expect(bob.team.hasRole('MANAGERS')).toBe(false)
    alice.team.addRole('MANAGERS')

    // ✅ Bob sees the new role 👨🏻‍🦲💭
    await updated(alice, bob)
    expect(bob.team.hasRole('MANAGERS')).toBe(true)

    // 👩🏾 Alice adds Bob to the new role
    expect(alice.team.memberHasRole('bob', 'MANAGERS')).toBe(false)
    expect(bob.team.memberHasRole('bob', 'MANAGERS')).toBe(false)
    alice.team.addMemberRole('bob', 'MANAGERS')

    // ✅ 👨🏻‍🦲 Bob sees the change 👨🏻‍🦲💭
    await updated(alice, bob)
    expect(bob.team.memberHasRole('bob', 'MANAGERS')).toBe(true)
  })

  test('resolves concurrent non-conflicting changes when updating', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👩🏾 Alice creates a new role
    expect(alice.team.hasRole('MANAGERS')).toBe(false)
    alice.team.addRole('MANAGERS')
    expect(alice.team.hasRole('MANAGERS')).toBe(true)

    // 👨🏻‍🦲 concurrently, Bob invites Charlie
    const { id } = bob.team.invite('charlie')
    expect(bob.team.hasInvitation(id)).toBe(true)

    // Bob doesn't see the new role
    expect(bob.team.hasRole('MANAGERS')).toBe(false)

    // Alice doesn't see Bob's invitation for Charlie
    expect(alice.team.hasInvitation(id)).toBe(false)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ now Bob does see the new role 👨🏻‍🦲💭
    expect(bob.team.hasRole('MANAGERS')).toBe(true)

    // ✅ and Alice does see the invitation 👩🏾💭
    expect(alice.team.hasInvitation(id)).toBe(true)
  })

  test('resolves concurrent duplicate changes when updating', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👩🏾 Alice creates a new role
    alice.team.addRole('MANAGERS')
    expect(alice.team.hasRole('MANAGERS')).toBe(true)

    // 👨🏻‍🦲 concurrently, Bob adds the same role
    bob.team.addRole('MANAGERS')
    expect(bob.team.hasRole('MANAGERS')).toBe(true)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ nothing blew up, and they both have the role
    expect(alice.team.hasRole('MANAGERS')).toBe(true)
    expect(bob.team.hasRole('MANAGERS')).toBe(true)
  })

  test('resolves concurrent duplicate removals', async () => {
    const { alice, bob } = setup(['alice', 'bob', 'charlie'])

    // 👳🏽‍♂️ Charlie is a member
    expect(alice.team.has('charlie')).toBe(true)
    expect(bob.team.has('charlie')).toBe(true)

    // 👨🏻‍🦲 Bob removes 👳🏽‍♂️ Charlie
    bob.team.remove('charlie')

    // 👩🏾 concurrently, Alice also removes 👳🏽‍♂️ Charlie
    alice.team.remove('charlie')

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ nothing blew up, and Charlie has been removed on both sides 👳🏽‍♂️👎
    expect(alice.team.has('charlie')).toBe(false)
    expect(bob.team.has('charlie')).toBe(false)
  })

  test('lets a member remove the founder', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // 👨🏻‍🦲 Bob removes Alice
    bob.team.remove('alice')

    // 👩🏾🔌👨🏻‍🦲 Alice is no longer a member, so they're disconnected
    await disconnection(alice, bob)

    // ✅ Alice is no longer on the team 👩🏾👎
    expect(bob.team.has('alice')).toBe(false)
    expect(alice.team.has('alice')).toBe(false)
  })

  test('eventually updates disconnected members when someone uses an invitation to join', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', { user: 'charlie', member: false }])

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie
    const { seed } = alice.team.invite('charlie')

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, charlie, seed)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅
    expectEveryoneToKnowEveryone(alice, charlie, bob)
  })

  test('updates connected members when someone uses an invitation to join', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', { user: 'charlie', member: false }])

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie
    const { seed } = alice.team.invite('charlie')

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, charlie, seed)

    // Wait for Alice & Bob to sync up
    await updated(alice, bob)

    // ✅
    expectEveryoneToKnowEveryone(alice, charlie, bob)
  })

  test('resolves concurrent duplicate invitations when updating', async () => {
    const { alice, bob, charlie, dwight } = setup([
      'alice',
      'bob',
      { user: 'charlie', member: false },
      { user: 'dwight', member: false },
    ])

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie and Dwight
    const aliceInvitesCharlie = alice.team.invite('charlie')
    const _aliceInvitesDwight = alice.team.invite('dwight') // invitation unused, but that's OK

    // 👨🏻‍🦲📧👳🏽‍♂️👴 concurrently, Bob invites Charlie and Dwight
    const _bobInvitesCharlie = bob.team.invite('charlie') // invitation unused, but that's OK
    const bobInvitesDwight = bob.team.invite('dwight')

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, charlie, aliceInvitesCharlie.seed)

    // 👴📧<->👨🏻‍🦲 Dwight connects to Bob and uses his invitation to join
    await connectWithInvitation(bob, dwight, bobInvitesDwight.seed)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    connect(alice, bob)

    // let everyone catch up
    await Promise.all([updated(dwight, bob), updated(charlie, alice)])

    // ✅ No problemo
    expectEveryoneToKnowEveryone(alice, charlie, bob, dwight)
  })

  test(`handles concurrent admittance of the same invitation`, async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', { user: 'charlie', member: false }])

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie
    const { seed } = alice.team.invite('charlie')

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect, so Bob knows about the invitation
    await connect(alice, bob)
    await disconnect(alice, bob)

    await Promise.all([
      // 👳🏽‍♂️📧<->👩🏾 Charlie presents his invitation to Alice
      connectWithInvitation(alice, charlie, seed),

      // 👳🏽‍♂️📧<-> 👨🏻‍🦲 concurrently Charlie presents his invitation to Bob
      connectWithInvitation(bob, charlie, seed),
    ])

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ It all works out
    expectEveryoneToKnowEveryone(alice, bob, charlie)
  })

  test.only('resolves mutual demotions in favor of the senior member', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👨🏻‍🦲 Bob removes 👩🏾 Alice from admin role
    bob.team.removeMemberRole('alice', ADMIN)

    // 👩🏾 Alice concurrently removes 👨🏻‍🦲 Bob from admin role
    alice.team.removeMemberRole('bob', ADMIN)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect. Bob's demotion of Alice is discarded (because they wer
    // done concurrently and Alice is senior so she wins)
    await connect(alice, bob)

    // ✅ Alice is still an admin 👩🏾👍
    expect(alice.team.memberIsAdmin('alice')).toBe(true)
    expect(bob.team.memberIsAdmin('alice')).toBe(true)

    // ✅ Bob is no longer an admin 👨🏻‍🦲👎
    expect(alice.team.memberIsAdmin('bob')).toBe(false)
    expect(bob.team.memberIsAdmin('bob')).toBe(false)

    // ✅ They are still connected 👩🏾<->👨🏻‍🦲
    expect(alice.getState('bob')).toEqual('connected')
    expect(bob.getState('alice')).toEqual('connected')
  })

  test('resolves mutual removals in favor of the senior member', async () => {
    const { alice, bob, charlie, dwight } = setup(['alice', 'bob', 'charlie', 'dwight'])

    // 👨🏻‍🦲 Bob removes 👩🏾 Alice
    bob.team.remove('alice')

    // 👩🏾 Alice concurrently removes 👨🏻‍🦲 Bob
    alice.team.remove('bob')

    // 👳🏽‍♂️<->👨🏻‍🦲 Charlie and Bob connect
    await connect(bob, charlie)
    // 👳🏽‍♂️💭 Charlie now knows that Bob has removed Alice
    expect(charlie.team.has('alice')).toBe(false)

    // 👴<->👩🏾 Dwight and Alice connect
    await connect(alice, dwight)

    // 👴💭 Dwight now knows that Alice has removed Bob
    expect(dwight.team.has('bob')).toBe(false)

    // 👴<->👳🏽‍♂️ Dwight and Charlie connect
    await connect(dwight, charlie)

    // 👴💭 👳🏽‍♂️💭 Both Dwight and Charlie now know about the mutual conflicting removals.

    // They each discard Bob's removal of Alice (because they were done concurrently and
    // Alice is senior so she wins)

    // ✅ Both kept Alice 👩🏾👍
    expect(dwight.team.has('alice')).toBe(true)
    expect(charlie.team.has('alice')).toBe(true)

    // ✅ Both removed Bob 👨🏻‍🦲👎
    expect(dwight.team.has('bob')).toBe(false)
    expect(charlie.team.has('bob')).toBe(false)

    // ✅ Charlie is disconnected from Bob because Bob is no longer a member 👳🏽‍♂️🔌👨🏻‍🦲
    await disconnection(bob, charlie)
  })

  test(`when a member is demoted and makes concurrent changes, discards those changes`, async () => {
    const { alice, bob } = setup(['alice', 'bob', { user: 'charlie', admin: false }])

    // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
    alice.team.removeMemberRole('bob', ADMIN)

    // 👨🏻‍🦲 concurrently, Bob makes 👳🏽‍♂️ Charlie an admin
    bob.team.addMemberRole('charlie', ADMIN)
    expect(bob.team.memberHasRole('charlie', ADMIN)).toBe(true)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ Bob's promotion of Charlie is discarded, because Bob concurrently lost admin privileges. 👨🏻‍🦲👳🏽‍♂️👎
    expect(alice.team.memberHasRole('charlie', ADMIN)).toBe(false)
    expect(bob.team.memberHasRole('charlie', ADMIN)).toBe(false)
  })

  test('lets a member use an invitation to add a device', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👨🏻‍🦲💻📧->📱 on his laptop, Bob creates an invitation and somehow gets it to his phone
    const { seed } = bob.team.invite('bob')

    // 💻<->📱📧 Bob's phone and laptop connect and the phone joins
    await connectPhoneWithInvitation(bob, seed)

    // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
    expect(bob.team.members('bob').devices).toHaveLength(2)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ 👩🏾👍📱 Alice knows about Bob's phone
    expect(alice.team.members('bob').devices).toHaveLength(2)
  })

  test(`when a member is demoted and concurrently adds a device, the new device is kept`, async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
    alice.team.removeMemberRole('bob', ADMIN)

    // 👨🏻‍🦲💻📧📱 concurrently, on his laptop, Bob invites his phone
    const { seed } = bob.team.invite('bob')

    // 💻<->📱 Bob's phone and laptop connect and the phone joins
    await connectPhoneWithInvitation(bob, seed)

    // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
    expect(bob.team.members('bob').devices).toHaveLength(2)

    // 👩🏾 Alice doesn't know about the new device
    expect(alice.team.members('alice').devices).toHaveLength(1)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ Bob's phone is still in his devices
    // expect(bob.team.members('bob').devices).toHaveLength(2)

    // ✅ Alice knows about the new device
    // expect(alice.team.members('bob').devices).toHaveLength(2)
  })

  // test(`when a member is demoted and concurrently invites a member and the member joins, the new member is removed`, async () => {
  //   // Alice removes Bob from admins
  //   // concurrently, Bob invites Charlie
  //   // Bob and Charlie connect
  //   // Alice and Bob connect
  //   // Charlie's invitation is gone
  // })

  test('sends updates across multiple hops', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', 'charlie'])

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)
    // 👨🏻‍🦲<->👳🏽‍♂️ Bob and Charlie connect
    await connect(bob, charlie)

    // 👩🏾 Alice creates a new role
    alice.team.addRole('MANAGERS')

    await Promise.all([updated(alice, bob), updated(bob, charlie)])

    // ✅ Charlie sees the new role, even though he's not connected directly to Alice 👳🏽‍♂️💭
    expect(charlie.team.hasRole('MANAGERS')).toEqual(true)
  })

  test('handles three-way connections', async () => {
    const allUpdated = () =>
      Promise.all([updated(alice, bob), updated(bob, charlie), updated(alice, charlie)])

    const { alice, bob, charlie } = setup(['alice', 'bob', 'charlie'])
    alice.team.addMemberRole('charlie', ADMIN) // Charlie needs to be an admin to do stuff

    // 👩🏾<->👨🏻‍🦲<->👳🏽‍♂️ Alice, Bob, and Charlie all connect to each other
    await connect(alice, bob)
    await connect(bob, charlie)
    await connect(alice, charlie)

    // <-> while connected...

    // 👩🏾 Alice adds a new role
    alice.team.addRole('ALICES_FRIENDS')
    await allUpdated()

    // 👨🏻‍🦲 Bob adds a new role
    bob.team.addRole('BOBS_FRIENDS')
    await allUpdated()

    // 👳🏽‍♂️ Charlie adds a new role
    charlie.team.addRole('CHARLIES_FRIENDS')
    await allUpdated()

    // ✅ All three get the three new roles
    expect(bob.team.hasRole('ALICES_FRIENDS')).toBe(true)
    expect(charlie.team.hasRole('ALICES_FRIENDS')).toBe(true)
    expect(alice.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
    expect(bob.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
    expect(alice.team.hasRole('BOBS_FRIENDS')).toBe(true)
    expect(charlie.team.hasRole('BOBS_FRIENDS')).toBe(true)
  })

  test('resolves concurrent non-conflicting changes in three-way connections', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', 'charlie'])

    // 🔌 while disconnected...

    // 👩🏾 Alice adds a new role
    alice.team.addRole('ALICES_FRIENDS')

    // 👨🏻‍🦲 Bob adds a new role
    bob.team.addRole('BOBS_FRIENDS')

    // 👳🏽‍♂️ Charlie adds a new role
    charlie.team.addRole('CHARLIES_FRIENDS')

    // 👩🏾<->👨🏻‍🦲<->👳🏽‍♂️ Alice, Bob, and Charlie all connect to each other
    await connect(alice, bob)
    await connect(bob, charlie)
    await connect(alice, charlie)

    // ✅ All three get the three new roles
    expect(bob.team.hasRole('ALICES_FRIENDS')).toBe(true)
    expect(charlie.team.hasRole('ALICES_FRIENDS')).toBe(true)
    expect(alice.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
    expect(bob.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
    expect(alice.team.hasRole('BOBS_FRIENDS')).toBe(true)
    expect(charlie.team.hasRole('BOBS_FRIENDS')).toBe(true)
  })

  // test('resolves concurrent conflicting changes in three-way connections', async () => {
  //   // Alice, Bob and Charlie are admins
  //
  //   // Alice and Bob connect
  //   // Alice and Charlie connect
  //   // Bob and Charlie connect
  // })

  test.only('resolves circular concurrent demotions ', async () => {
    const { alice, bob, charlie, dwight } = setup(['alice', 'bob', 'charlie', 'dwight'])

    // Bob demotes Charlie
    bob.team.removeMemberRole('charlie', ADMIN)

    // Charlie demotes Alice
    charlie.team.removeMemberRole('alice', ADMIN)

    // Alice demotes Bob
    alice.team.removeMemberRole('bob', ADMIN)

    // Dwight connects to all three
    await connect(dwight, alice)
    await connect(dwight, bob)
    await connect(dwight, charlie)

    const isAdmin = dwight.team.memberIsAdmin

    // Bob is no longer an admin
    expect(isAdmin('bob')).toBe(false)

    // Alice is still an admin (because seniority)
    expect(isAdmin('alice')).toBe(true)

    // Charlie is still an admin (because Bob demoted him while being demoted)
    expect(isAdmin('charlie')).toBe(true)
  })

  // test.only('resolves circular concurrent removals ', async () => {
  //   const { alice, bob, charlie, dwight } = setup(['alice', 'bob', 'charlie', 'dwight'])

  //   // Bob removes Charlie
  //   bob.team.remove('charlie')

  //   // Charlie removes Alice
  //   charlie.team.remove('alice')

  //   // Alice removes Bob
  //   alice.team.remove('bob')

  //   // Dwight connects to all three
  //   await Promise.all([
  //     connect(dwight, alice), //
  //     connect(dwight, bob),
  //     connect(dwight, charlie),
  //   ])

  //   // Bob is off the team
  //   expect(dwight.team.has('bob')).toBe(false)

  //   // Alice is on the team
  //   expect(dwight.team.has('alice')).toBe(true)

  //   // Charlie?? not sure
  //   expect(dwight.team.has('charlie')).toBe(true)
  // })

  // test('rotates keys after a member is removed', async () => {
  // test('rotates keys after a device is removed', async () => {

  // test(`Eve steals Charlie's only device; Alice heals the team`, async () => {
  //   // Eve steals Charlie's laptop
  //   // Alice removes the laptop from the team
  //   // Eve uses Charlie's laptop to try to connect to Bob, but she can't
  //   // Alice sends Charlie a new invitation; he's able to use it to connect from his phone
  // })

  // test(`Eve steals one of Charlie's devices; Charlie heals the team`, async () => {
  //   // Charlie invites his phone and it joins
  //   // Eve steals Charlie's phone
  //   // From his laptop, Charlie removes the phone from the team
  //   // Eve uses Charlie's phone to try to connect to Bob, but she can't
  // })

  // SETUP

  const setup = (_setupUserSettings: (TestUserSettings | string)[] = []) => {
    // Coerce input into expanded format
    const setupUserSettings = _setupUserSettings.map(user =>
      typeof user === 'string' ? { user } : user
    )

    // Get a list of just user names
    const userNames = setupUserSettings.map(user => user.user)

    // Create a new team
    const allTestUsers: Record<string, User> = { alice, bob, charlie, dwight }
    const getUserContext = (userName: string): LocalUserContext => {
      const user = allTestUsers[userName]
      return { user }
    }
    const sourceTeam = teams.create('Spies Я Us', getUserContext('alice'))

    // Add members
    for (const { user: userName, admin = true, member = true } of setupUserSettings) {
      if (member && !sourceTeam.has(userName)) {
        sourceTeam.add(allTestUsers[userName], admin ? [ADMIN] : [])
      }
    }

    // Create one channel per pair of users
    const pairKey = (a: string, b: string) => [a, b].sort().join(':')
    const channels = {} as Record<string, TestChannel>
    for (const a of userNames)
      for (const b of userNames)
        if (a !== b) {
          // Don't connect to ourselves
          const pair = pairKey(a, b)
          // Only one channel per pair
          if (!(pair in channels)) channels[pair] = new TestChannel()
        }

    const makeUserStuff = ({ user: userName, member = true }: TestUserSettings) => {
      const user = allTestUsers[userName]
      const context = getUserContext(userName)
      const laptop = redactDevice(user.device)
      const team = member
        ? teams.load(JSON.stringify(sourceTeam.chain), context) // members get a copy of the source team
        : teams.create(userName, context) // non-members get a dummy empty placeholder team

      const connectionContext = member ? { team, user, device: laptop } : { user, device: laptop }

      const phone = (() => {
        const name = `${userName}'s phone`
        const deviceInfo = { type: DeviceType.mobile, name: name, userName }
        const deviceKeys = keysets.create({ type: KeyType.DEVICE, name: getDeviceId(deviceInfo) })
        const device: DeviceWithSecrets = { ...deviceInfo, keys: deviceKeys }
        const publicDevice = redactDevice(device)
        const connectionContext = {
          user: { ...user, device },
          // TODO: it's probably redundant to include the device on the connection context, since the user has it
          device: publicDevice,
        }
        return { device, connectionContext }
      })()

      const userStuff = {
        userName,
        user,
        context,
        laptop,
        phone,
        team,
        connectionContext,
        channel: {} as Record<string, TestChannel>,
        connection: {} as Record<string, Connection>,
        getState: (u: string) => userStuff.connection[u].state,
      } as UserStuff
      return userStuff
    }

    const addConnectionToEachOtherUser = (A: UserStuff) => {
      // only make connections if A is a member
      if ('team' in A.connectionContext) {
        const a = A.userName
        for (const { user: b, member = true } of setupUserSettings) {
          // don't connect to ourselves
          if (a !== b) {
            const pair = pairKey(a, b)
            const channel = channels[pair]!
            const join = joinTestChannel(channel)
            A.channel[b] = channel
            // only make connection if B is a member
            if (member) A.connection[b] = join(A.connectionContext)
          }
        }
      }
      return A
    }

    const testUsers: Record<string, UserStuff> = setupUserSettings
      .map(makeUserStuff)
      .map(addConnectionToEachOtherUser)
      .reduce(arrayToMap('userName'), {})

    return testUsers
  }

  // HELPERS

  /** Connects the two members and waits for them to be connected */
  const connect = async (a: UserStuff, b: UserStuff) => {
    a.connection[b.userName].start()
    b.connection[a.userName].start()
    await connection(a, b)
  }

  /** Connects a (a member) with b (invited using the given seed). */
  const connectWithInvitation = async (a: UserStuff, b: UserStuff, seed: string) => {
    const join = joinTestChannel(a.channel[b.userName])
    b.connectionContext.invitationSeed = seed
    a.connection[b.userName] = join(a.connectionContext).start()
    b.connection[a.userName] = join(b.connectionContext).start()
    return connection(a, b).then(() => {
      // The connection now has the team object, so let's update our user stuff
      b.team = b.connection[a.userName].team!
    })
  }

  const connectPhoneWithInvitation = async (a: UserStuff, seed: string) => {
    const join = joinTestChannel(new TestChannel())
    a.phone.connectionContext.invitationSeed = seed

    const laptop = join(a.connectionContext).start()
    const phone = join(a.phone.connectionContext).start()
    await all([laptop, phone], 'connected')
  }

  /** Passes if each of the given members is on the team, and knows every other member on the team */
  const expectEveryoneToKnowEveryone = (...members: UserStuff[]) => {
    for (const a of members)
      for (const b of members) //
        expect(a.team.has(b.userName)).toBe(true)
  }

  /** Disconnects the two members and waits for them to be disconnected */
  const disconnect = async (a: UserStuff, b: UserStuff) =>
    Promise.all([
      disconnection(a, b),
      a.connection[b.userName].stop(),
      b.connection[a.userName].stop(),
    ])

  // Promisified events

  const connection = async (a: UserStuff, b: UserStuff) => {
    const connections = [a.connection[b.userName], b.connection[a.userName]]

    // We're listening for a connection; if we're disconnected, throw an error
    connections.forEach(c =>
      c.on('disconnected', () => {
        throw new Error(c.error?.message || 'Diconnected')
      })
    )

    // ✅ They're both connected
    await all(connections, 'connected')

    // Remove the disconnect listeners so we don't throw errors later on
    connections.forEach(c => c.removeAllListeners())

    const sharedKey = connections[0].sessionKey
    connections.forEach(connection => {
      expect(connection.state).toEqual('connected')
      // ✅ They've converged on a shared secret key
      expect(connection.sessionKey).toEqual(sharedKey)
    })
  }

  const updated = (a: UserStuff, b: UserStuff) => {
    const connections = [a.connection[b.userName], b.connection[a.userName]]
    return all(connections, 'updated')
  }
  const disconnection = async (a: UserStuff, b: UserStuff, message?: string) => {
    const connections = [a.connection[b.userName], b.connection[a.userName]]

    // ✅ They're both disconnected
    await all(connections, 'disconnected')

    connections.forEach(connection => {
      expect(connection.state).toEqual('disconnected')
      // ✅ If we're checking for a message, it matches
      if (message !== undefined) expect(connection.error!.message).toContain(message)
    })
  }

  const all = (connections: Connection[], event: string) =>
    Promise.all(
      connections.map(connection => {
        if (event === 'disconnect' && connection.state === 'disconnected') return true
        if (event === 'connected' && connection.state === 'connected') return true
        else return new Promise(resolve => connection.on(event, () => resolve()))
      })
    )

  // Logging

  const testName = () => expect.getState().currentTestName
  beforeEach(() => log.header('TEST: ' + testName()))
})

// TYPES

type TestUserSettings = {
  user: string
  admin?: boolean
  member?: boolean
}

interface UserStuff {
  userName: string
  user: User
  context: LocalUserContext
  laptop: PublicDevice
  phone: {
    device: DeviceWithSecrets
    connectionContext: InitialContext
  }
  team: Team
  connectionContext: InitialContext
  channel: Record<string, TestChannel>
  connection: Record<string, Connection>
  getState: (u: string) => any
}
