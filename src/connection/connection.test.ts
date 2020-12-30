import { ADMIN } from '/role'
import { debug } from '/util'
import {
  connect,
  connectPhoneWithInvitation,
  connectWithInvitation,
  disconnect,
  disconnection,
  expectEveryoneToKnowEveryone,
  setup,
} from '/util/testing/setup'

const log = debug('lf:auth:test')

beforeAll(() => {})

describe('connectionStream', () => {
  it('connects two members', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
    await connect(alice, bob)

    // 👩🏾 👨🏻‍🦲 Alice and Bob both leave the channel
    await disconnect(alice, bob)
  })

  it(`doesn't connect with a member who has been removed`, async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👩🏾 Alice removes Bob
    alice.team.remove('bob')

    // ❌ They can't connect because Bob was removed
    connect(alice, bob)
    await disconnection(alice, bob)
  })

  it(`doesn't connect with someone who doesn't belong to the team`, async () => {
    const { alice, charlie } = setup(['alice', 'bob', { user: 'charlie', member: false }])

    // ❌ Alice and Charlie can't connect because Charlie was never on the team
    connect(alice, charlie)
    await disconnection(alice, charlie)
  })

  it(`can reconnect after disconnecting`, async () => {
    const { alice, bob } = setup(['alice', 'bob'])
    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // 👩🏾🔌👨🏻‍🦲 Alice and Bob disconnect
    await disconnect(alice, bob)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob reconnect
    await connect(alice, bob)

    // ✅ all good
  })

  it('updates remote user after connecting', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // at this point, Alice and Bob have the same signature chain

    // 👩🏾 but now Alice does some stuff
    alice.team.invite('charlie')
    alice.team.addRole('managers')
    alice.team.addMemberRole('charlie', 'managers')

    // 👨🏻‍🦲 Bob hasn't connected, so he doesn't have Alice's changes
    expect(bob.team.has('charlie')).toBe(false)
    expect(bob.team.hasRole('managers')).toBe(false)

    // 👩🏾 👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ 👨🏻‍🦲 Bob is up to date with Alice's changes
    expect(bob.team.has('charlie')).toBe(true)
    expect(bob.team.hasRole('managers')).toBe(true)
    expect(bob.team.memberHasRole('charlie', 'managers')).toBe(true)
  })

  it('updates local user after connecting', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // at this point, Alice and Bob have the same signature chain

    // 👨🏻‍🦲 but now Bob does some stuff
    bob.team.invite('charlie')
    bob.team.addRole('managers')
    bob.team.addMemberRole('charlie', 'managers')

    // 👩🏾 👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ 👩🏾 Alice is up to date with Bob's changes
    expect(alice.team.has('charlie')).toBe(true)
    expect(alice.team.hasRole('managers')).toBe(true)
    expect(alice.team.memberHasRole('charlie', 'managers')).toBe(true)
  })

  it('resolves concurrent non-conflicting changes when updating', async () => {
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

  it('resolves concurrent duplicate changes when updating', async () => {
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

  it('resolves concurrent duplicate removals', async () => {
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

    // ✅ nothing blew up, and Charlie has been removed on both sides 🚫👳🏽‍♂️
    expect(alice.team.has('charlie')).toBe(false)
    expect(bob.team.has('charlie')).toBe(false)
  })

  it('lets a member remove the founder', async () => {
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

  it('connects an invitee with a member', async () => {
    const { alice, bob } = setup(['alice', { user: 'bob', member: false }])

    // 👩🏾📧👴 Alice invites Bob
    const { invitationSeed: seed } = alice.team.invite('bob')

    // 👴📧<->👩🏾 Bob connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, bob, seed)

    // ✅
    expectEveryoneToKnowEveryone(alice, bob)
  })

  it(`doesn't allow two invitees to connect`, async () => {
    const { alice, charlie, dwight } = setup([
      'alice',
      { user: 'charlie', member: false },
      { user: 'dwight', member: false },
    ])

    // 👩🏾 Alice invites 👳🏽‍♂️ Charlie
    const { invitationSeed: charlieSeed } = alice.team.invite('charlie')
    charlie.connectionContext.invitationSeed = charlieSeed

    // 👩🏾 Alice invites 👴 Dwight
    const { invitationSeed: dwightSeed } = alice.team.invite('dwight')
    dwight.connectionContext.invitationSeed = dwightSeed

    // 👳🏽‍♂️<->👴 Charlie and Dwight try to connect to each other
    connect(charlie, dwight)

    // ✅ ❌ They're unable to connect because at least one needs to be a member
    await disconnection(charlie, dwight, 'neither one of us is a member')
  })

  it('eventually updates disconnected members when someone uses an invitation to join', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', { user: 'charlie', member: false }])

    // 👩🏾📧👳🏽‍♂️ Alice invites Charlie
    const { invitationSeed: seed } = alice.team.invite('charlie')

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, charlie, seed)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅
    expectEveryoneToKnowEveryone(alice, charlie, bob)
  })

  it('updates connected members when someone uses an invitation to join', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', { user: 'charlie', member: false }])

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie
    const { invitationSeed: seed } = alice.team.invite('charlie')

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, charlie, seed)

    // ✅
    expectEveryoneToKnowEveryone(alice, charlie, bob)
  })

  it.only('resolves concurrent duplicate invitations when updating', async () => {
    const { alice, bob, charlie, dwight } = setup([
      'alice',
      'bob',
      { user: 'charlie', member: false },
      { user: 'dwight', member: false },
    ])

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie and Dwight
    const aliceInvitesCharlie = alice.team.invite('charlie')
    const aliceInvitesDwight = alice.team.invite('dwight') // invitation unused, but that's OK

    // 👨🏻‍🦲📧👳🏽‍♂️👴 concurrently, Bob invites Charlie and Dwight
    const bobInvitesCharlie = bob.team.invite('charlie') // invitation unused, but that's OK
    const bobInvitesDwight = bob.team.invite('dwight')

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    log('Charlie connects to Alice and uses his invitation to join')
    await connectWithInvitation(alice, charlie, aliceInvitesCharlie.invitationSeed)

    // 👴📧<->👨🏻‍🦲 Dwight connects to Bob and uses his invitation to join
    log('Dwight connects to Bob and uses his invitation to join')
    await connectWithInvitation(bob, dwight, bobInvitesDwight.invitationSeed)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    log('Alice and Bob connect')
    await connect(alice, bob)

    // ✅ No problemo
    log('No problemo')
    expectEveryoneToKnowEveryone(alice, charlie, bob, dwight)
  })

  it(`handles concurrent admittance of the same invitation`, async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', { user: 'charlie', member: false }])

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie
    const { invitationSeed: seed } = alice.team.invite('charlie')

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

  it('resolves mutual demotions in favor of the senior member', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👨🏻‍🦲 Bob removes 👩🏾 Alice from admin role
    bob.team.removeMemberRole('alice', ADMIN)

    // 👩🏾 Alice concurrently removes 👨🏻‍🦲 Bob from admin role
    alice.team.removeMemberRole('bob', ADMIN)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect. Bob's demotion of Alice is discarded (because they were
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

  it('resolves mutual removals in favor of the senior member', async () => {
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

  it(`when a member is demoted and makes concurrent changes, discards those changes`, async () => {
    const { alice, bob } = setup(['alice', 'bob', { user: 'charlie', admin: false }])

    // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
    alice.team.removeMemberRole('bob', ADMIN)

    // 👨🏻‍🦲 concurrently, Bob makes 👳🏽‍♂️ Charlie an admin
    bob.team.addMemberRole('charlie', ADMIN)
    expect(bob.team.memberHasRole('charlie', ADMIN)).toBe(true)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ Bob's promotion of Charlie is discarded, because Bob concurrently lost admin privileges. 🚫👨🏻‍🦲👳🏽‍♂️
    expect(alice.team.memberHasRole('charlie', ADMIN)).toBe(false)
    expect(bob.team.memberHasRole('charlie', ADMIN)).toBe(false)
  })

  it('lets a member use an invitation to add a device', async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👨🏻‍🦲💻📧->📱 on his laptop, Bob creates an invitation and somehow gets it to his phone
    const { invitationSeed: seed } = bob.team.invite('bob')

    // 💻<->📱📧 Bob's phone and laptop connect and the phone joins
    await connectPhoneWithInvitation(bob, seed)

    // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
    expect(bob.team.members('bob').devices).toHaveLength(2)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ 👩🏾👍📱 Alice knows about Bob's phone
    expect(alice.team.members('bob').devices).toHaveLength(2)
  })

  it(`when a member is demoted and concurrently adds a device, the new device is kept`, async () => {
    const { alice, bob } = setup(['alice', 'bob'])

    // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
    alice.team.removeMemberRole('bob', ADMIN)

    // 👨🏻‍🦲💻📧📱 concurrently, on his laptop, Bob invites his phone
    const { invitationSeed: seed } = bob.team.invite('bob')

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

  it('sends updates across multiple hops', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', 'charlie'])

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)
    // 👨🏻‍🦲<->👳🏽‍♂️ Bob and Charlie connect
    await connect(bob, charlie)

    // 👩🏾 Alice creates a new role
    alice.team.addRole('MANAGERS')

    // ✅ Charlie sees the new role, even though he's not connected directly to Alice 👳🏽‍♂️💭
    expect(charlie.team.hasRole('MANAGERS')).toEqual(true)
  })

  it('handles three-way connections', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', 'charlie'])
    alice.team.addMemberRole('charlie', ADMIN) // Charlie needs to be an admin to do stuff

    // 👩🏾<->👨🏻‍🦲<->👳🏽‍♂️ Alice, Bob, and Charlie all connect to each other
    await connect(alice, bob)
    await connect(bob, charlie)
    await connect(alice, charlie)

    // <-> while connected...

    // 👩🏾 Alice adds a new role
    alice.team.addRole('ALICES_FRIENDS')

    // 👨🏻‍🦲 Bob adds a new role
    bob.team.addRole('BOBS_FRIENDS')

    // 👳🏽‍♂️ Charlie adds a new role
    charlie.team.addRole('CHARLIES_FRIENDS')

    // ✅ All three get the three new roles
    expect(bob.team.hasRole('ALICES_FRIENDS')).toBe(true)
    expect(charlie.team.hasRole('ALICES_FRIENDS')).toBe(true)
    expect(alice.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
    expect(bob.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
    expect(alice.team.hasRole('BOBS_FRIENDS')).toBe(true)
    expect(charlie.team.hasRole('BOBS_FRIENDS')).toBe(true)
  })

  it('resolves concurrent non-conflicting changes in three-way connections', async () => {
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

  it('resolves concurrent duplicate changes in three-way connections', async () => {
    const { alice, bob, charlie } = setup(['alice', 'bob', 'charlie'])

    // 🔌 while disconnected...

    // 👩🏾 Alice adds a new role
    alice.team.addRole('MANAGERS')

    // 👨🏻‍🦲 Bob adds the same role
    bob.team.addRole('MANAGERS')

    // 👳🏽‍♂️ Charlie adds the same role!! WHAT??!!
    charlie.team.addRole('MANAGERS')

    // 👩🏾<->👨🏻‍🦲<->👳🏽‍♂️ Alice, Bob, and Charlie all connect to each other
    await connect(alice, bob)
    await connect(bob, charlie)
    await connect(alice, charlie)

    // ✅ All three get the three new roles, and nothing bad happened
    expect(alice.team.hasRole('MANAGERS')).toBe(true)
    expect(bob.team.hasRole('MANAGERS')).toBe(true)
    expect(charlie.team.hasRole('MANAGERS')).toBe(true)
  })

  it('resolves circular concurrent demotions ', async () => {
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
})
