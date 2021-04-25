import { getDeviceId } from '@/device'
import { generateStarterKeys } from '@/invitation'
import { KeyType } from '@/keyset'
import { ADMIN } from '@/role'
import { debug } from '@/util'
import {
  all,
  connect,
  connection,
  connectPhoneWithInvitation,
  connectWithInvitation,
  disconnect,
  disconnection,
  expectEveryoneToKnowEveryone,
  joinTestChannel,
  setup,
  TestChannel,
  tryToConnect,
  updated,
} from '@/util/testing'

const log = debug('lf:auth:test')
const { DEVICE, MEMBER } = KeyType

beforeAll(() => {})

describe('connection', () => {
  it('connects two members', async () => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
    await connect(alice, bob)

    // 👩🏾 👨🏻‍🦲 Alice and Bob both leave the channel
    await disconnect(alice, bob)
  })

  it.skip(`doesn't connect with a member who has been removed`, async () => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 Alice removes Bob
    alice.team.remove('bob')

    // ❌ They can't connect because Bob was removed
    connect(alice, bob)
    await disconnection(alice, bob, 'removed')
  })

  it(`doesn't connect with someone who doesn't belong to the team`, async () => {
    const { alice, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

    // ❌ Alice and Charlie can't connect because Charlie was never on the team
    tryToConnect(alice, charlie)
    await disconnection(alice, charlie)
  })

  it.skip(`can reconnect after disconnecting`, async () => {
    const { alice, bob } = setup('alice', 'bob')
    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // 👩🏾🔌👨🏻‍🦲 Alice disconnects
    alice.connection.bob.stop()
    await disconnection(alice, bob)

    // 👩🏾<->👨🏻‍🦲 Alice reconnects
    alice.connection.bob.start()
    await connection(alice, bob)

    // ✅ all good
  })

  it('updates remote user after connecting', async () => {
    const { alice, bob } = setup('alice', 'bob')

    // at this point, Alice and Bob have the same signature chain

    // 👩🏾 but now Alice does some stuff
    alice.team.invite({ userName: 'charlie' })
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
    const { alice, bob } = setup('alice', 'bob')

    // at this point, Alice and Bob have the same signature chain

    // 👨🏻‍🦲 but now Bob does some stuff
    bob.team.invite({ userName: 'charlie' })
    bob.team.addRole('managers')
    bob.team.addMemberRole('charlie', 'managers')

    // 👩🏾 👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ 👩🏾 Alice is up to date with Bob's changes
    expect(alice.team.has('charlie')).toBe(true)
    expect(alice.team.hasRole('managers')).toBe(true)
    expect(alice.team.memberHasRole('charlie', 'managers')).toBe(true)
  })

  it('updates local user while connected', async () => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // at this point, Alice and Bob have the same signature chain

    // 👨🏻‍🦲 now Bob does some stuff
    bob.team.invite({ userName: 'charlie' })
    bob.team.addRole('managers')
    bob.team.addMemberRole('charlie', 'managers')

    await updated(alice, bob)

    // ✅ 👩🏾 Alice is up to date with Bob's changes
    expect(alice.team.has('charlie')).toBe(true)
    expect(alice.team.hasRole('managers')).toBe(true)
    expect(alice.team.memberHasRole('charlie', 'managers')).toBe(true)
  })

  it('resolves concurrent non-conflicting changes when updating', async () => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 Alice creates a new role
    expect(alice.team.hasRole('MANAGERS')).toBe(false)
    alice.team.addRole('MANAGERS')
    expect(alice.team.hasRole('MANAGERS')).toBe(true)

    // 👨🏻‍🦲 concurrently, Bob invites Charlie
    const { id } = bob.team.invite({ userName: 'charlie' })
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
    const { alice, bob } = setup('alice', 'bob')

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
    const { alice, bob } = setup('alice', 'bob', 'charlie')

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
    const { alice, bob } = setup('alice', 'bob')

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
    const { alice, bob } = setup('alice', { user: 'bob', member: false })

    // 👩🏾📧👨🏻‍🦲 Alice invites Bob
    const { seed } = alice.team.invite({ userName: 'bob' })

    // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, bob, seed)

    // ✅
    expectEveryoneToKnowEveryone(alice, bob)
  })

  it('after being admitted, invitee has team keys', async () => {
    const { alice, bob } = setup('alice', { user: 'bob', member: false })

    // 👩🏾📧👨🏻‍🦲 Alice invites Bob
    const { seed } = alice.team.invite({ userName: 'bob' })

    // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, bob, seed)

    // update the team from the connection, which should have the new keys
    const connection = bob.connection.alice
    bob.team = connection.team!

    // 👨🏻‍🦲 Bob has the team keys
    expect(() => bob.team.teamKeys()).not.toThrow()
  })

  it(`doesn't allow two invitees to connect`, async () => {
    const { alice, charlie, dwight } = setup([
      'alice',
      { user: 'charlie', member: false },
      { user: 'dwight', member: false },
    ])

    // 👩🏾 Alice invites 👳🏽‍♂️ Charlie
    const { seed: charlieSeed } = alice.team.invite('charlie')
    charlie.context = {
      ...charlie.context,
      invitationSeed: charlieSeed,
    }

    // 👩🏾 Alice invites 👴 Dwight
    const { seed: dwightSeed } = alice.team.invite('dwight')
    dwight.context = {
      ...dwight.context,
      invitationSeed: dwightSeed,
    }

    // 👳🏽‍♂️<->👴 Charlie and Dwight try to connect to each other
    connect(charlie, dwight)

    // ✅ ❌ They're unable to connect because at least one needs to be a member
    await disconnection(charlie, dwight, 'neither one is a member')
  })

  it('eventually updates disconnected members when someone uses an invitation to join', async () => {
    const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

    // 👩🏾📧👳🏽‍♂️ Alice invites Charlie
    const { seed } = alice.team.invite({ userName: 'charlie' })

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, charlie, seed)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅
    expectEveryoneToKnowEveryone(alice, charlie, bob)
  })

  it('updates connected members when someone uses an invitation to join', async () => {
    const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie
    const { seed } = alice.team.invite({ userName: 'charlie' })

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    await connectWithInvitation(alice, charlie, seed)

    // ✅
    expectEveryoneToKnowEveryone(alice, charlie, bob)
  })

  // TODO: need to think some more about how to handle a situation where two members concurrently invite the same person.

  it.skip('resolves concurrent duplicate invitations when updating', async () => {
    const { alice, bob, charlie, dwight } = setup([
      'alice',
      'bob',
      { user: 'charlie', member: false },
      { user: 'dwight', member: false },
    ])

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie and Dwight
    const aliceInvitesCharlie = alice.team.invite({ userName: 'charlie' })
    const aliceInvitesDwight = alice.team.invite({ userName: 'dwight' }) // invitation unused, but that's OK

    // 👨🏻‍🦲📧👳🏽‍♂️👴 concurrently, Bob invites Charlie and Dwight
    const bobInvitesCharlie = bob.team.invite({ userName: 'charlie' }) // invitation unused, but that's OK
    const bobInvitesDwight = bob.team.invite({ userName: 'dwight' })

    // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
    log('Charlie connects to Alice and uses his invitation to join')
    await connectWithInvitation(alice, charlie, aliceInvitesCharlie.seed)

    // 👴📧<->👨🏻‍🦲 Dwight connects to Bob and uses his invitation to join
    log('Dwight connects to Bob and uses his invitation to join')
    await connectWithInvitation(bob, dwight, bobInvitesDwight.seed)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    log('Alice and Bob connect')
    await connect(alice, bob)

    // ✅ No problemo
    log('No problemo')
    expectEveryoneToKnowEveryone(alice, charlie, bob, dwight)
  })

  it.skip(`handles concurrent admittance of the same invitation`, async () => {
    const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

    // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie
    const { seed } = alice.team.invite({ userName: 'charlie' })

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
    const { alice, bob } = setup('alice', 'bob')

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
    const { alice, bob, charlie, dwight } = setup('alice', 'bob', 'charlie', 'dwight')

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
    const { alice, bob } = setup('alice', 'bob', { user: 'charlie', admin: false })

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
    const { alice, bob } = setup('alice', 'bob')

    // TODO: This should work if Alice and Bob connect here -- so they're already connected when the invitation is handled
    // await connect(alice, bob)
    // It doesn't work, because after Bob's laptop connects to his phone, Bob's laptop doesn't update Alice

    expect(bob.team.members('bob').devices).toHaveLength(1)
    expect(bob.team.adminKeys().generation).toBe(0)

    // 👨🏻‍🦲💻📧->📱 on his laptop, Bob creates an invitation and gets it to his phone
    const { deviceName } = bob.phone
    const { seed } = bob.team.invite({ deviceName })
    bob.phone.keys = generateStarterKeys({ type: DEVICE, name: getDeviceId(bob.phone) }, seed)

    // 💻<->📱📧 Bob's phone and laptop connect and the phone joins
    await connectPhoneWithInvitation(bob, seed)

    // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
    expect(bob.team.members('bob').devices).toHaveLength(2)
    expect(bob.team.adminKeys().generation).toBe(1)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ 👩🏾👍📱 Alice knows about Bob's phone
    expect(alice.team.members('bob').devices).toHaveLength(2)
    expect(alice.team.adminKeys().generation).toBe(1)
  })

  it(`when a member is demoted and concurrently adds a device, the new device is kept`, async () => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
    alice.team.removeMemberRole('bob', ADMIN)

    // 👨🏻‍🦲💻📧📱 concurrently, on his laptop, Bob invites his phone
    const { deviceName } = bob.phone
    const { seed } = bob.team.invite({ deviceName })
    bob.phone.keys = generateStarterKeys({ type: DEVICE, name: getDeviceId(bob.phone) }, seed)

    // 💻<->📱 Bob's phone and laptop connect and the phone joins
    await connectPhoneWithInvitation(bob, seed)

    // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
    expect(bob.team.members('bob').devices).toHaveLength(2)

    // 👩🏾 Alice doesn't know about the new device
    expect(alice.team.members('alice').devices).toHaveLength(1)

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)

    // ✅ Bob's phone is still in his devices
    expect(bob.team.members('bob').devices).toHaveLength(2)

    // ✅ Alice knows about the new device
    expect(alice.team.members('bob').devices).toHaveLength(2)
  })

  it('sends updates across multiple hops', async () => {
    const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

    // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
    await connect(alice, bob)
    // 👨🏻‍🦲<->👳🏽‍♂️ Bob and Charlie connect
    await connect(bob, charlie)

    // 👩🏾 Alice creates a new role
    alice.team.addRole('MANAGERS')

    await Promise.all([
      updated(alice, bob), //
      updated(bob, charlie),
    ])

    // ✅ Charlie sees the new role, even though he's not connected directly to Alice 👳🏽‍♂️💭
    expect(charlie.team.hasRole('MANAGERS')).toEqual(true)
  })

  it('handles three-way connections', async () => {
    const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

    const allUpdated = () =>
      Promise.all([
        updated(alice, bob), //
        updated(bob, charlie),
        updated(alice, charlie),
      ])

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

  it('resolves concurrent non-conflicting changes in three-way connections', async () => {
    const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

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
    const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

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
    const { alice, bob, charlie, dwight } = setup('alice', 'bob', 'charlie', 'dwight')

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

  // TODO: not clear what's supposed to be happpening here
  it.skip('connects an invitee while simultaneously making other changes', async () => {
    const { alice, bob } = setup('alice', { user: 'bob', member: false })

    // 👩🏾📧👨🏻‍🦲 Alice invites Bob
    const { seed } = alice.team.invite({ userName: 'bob' })

    // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
    bob.context = { ...bob.context, invitationSeed: seed }

    const join = joinTestChannel(new TestChannel())

    const a = (alice.connection.bob = join(alice.context).start())
    const b = (bob.connection.alice = join(bob.context).start())

    await all([a, b], 'connected')
    alice.team = a.team!
    bob.team = b.team!

    // ✅
    expect(alice.team.has('bob')).toBe(true)
    expect(bob.team.has('alice')).toBe(true)
  })

  it.skip('connects an invitee after one failed attempt', async () => {
    const { alice, bob } = setup('alice', { user: 'bob', member: false })

    // 👩🏾📧👨🏻‍🦲 Alice invites Bob
    const seed = 'passw0rd'
    alice.team.invite({ userName: 'bob', seed })

    // 👨🏻‍🦲📧<->👩🏾 Bob tries to connect, but mistypes his code
    bob.context = { ...bob.context, invitationSeed: 'password' }

    const join = joinTestChannel(new TestChannel())

    alice.connection.bob = join(alice.context).start()
    bob.connection.alice = join(bob.context).start()

    // ❌ The connection fails
    await disconnection(alice, bob)

    // 👨🏻‍🦲📧<->👩🏾 Bob tries again with the right code this time
    bob.context = { ...bob.context, invitationSeed: 'passw0rd' }

    // we can make this work by uncommenting the following lines, which start Alice and Bob
    // out with shiny new connections. However we want Bob to be able to try again with the same
    // connection. Maybe the answer is to separate out presenting an invitation from the HELLO message?
    //
    // It almost works if we don't restart Alice's connection, but she can't handle Bob's hello message coming in as #0.

    // bob.connection.alice = new Connection(bob.context).start()
    // alice.connection.bob = new Connection(alice.context).start()
    // alice.connection.bob.stream.pipe(bob.connection.alice.stream).pipe(alice.connection.bob.stream)

    // ✅ that works
    await connection(bob, alice)
    bob.team = bob.connection.alice.team!

    expectEveryoneToKnowEveryone(alice, bob)
  })

  it('rotates keys after a member is removed', async () => {
    const { alice, bob } = setup('alice', 'bob')
    await connect(alice, bob)

    // 👨🏻‍🦲 Bob has admin keys
    expect(() => bob.team.adminKeys()).not.toThrow()

    // We have the first-generation keys
    expect(alice.team.adminKeys().generation).toBe(0)
    expect(alice.team.teamKeys().generation).toBe(0)

    // <-> while connected...

    // 👩🏾 Alice removes Bob from the team
    alice.team.remove('bob')
    await disconnection(alice, bob)

    // 👨🏻‍🦲 Bob no longer has admin keys
    expect(() => bob.team.adminKeys()).toThrow()

    // The admin keys and team keys have been rotated
    expect(alice.team.adminKeys().generation).toBe(1)
    expect(alice.team.teamKeys().generation).toBe(1)
  })

  it('rotates keys after a member is demoted', async () => {
    const { alice, bob } = setup('alice', 'bob')
    await connect(alice, bob)

    // 👨🏻‍🦲 Bob has admin keys
    expect(() => bob.team.adminKeys()).not.toThrow()

    // We have the first-generation keys
    expect(alice.team.adminKeys().generation).toBe(0)

    // <-> while connected...

    // 👩🏾 Alice demotes Bob
    alice.team.removeMemberRole('bob', ADMIN)
    await updated(alice, bob)

    // 👨🏻‍🦲 Bob no longer has admin keys
    expect(() => bob.team.adminKeys()).toThrow()

    // The admin keys have been rotated
    expect(alice.team.adminKeys().generation).toBe(1)

    // The team keys haven't been rotated because Bob wasn't removed from the team
    expect(alice.team.teamKeys().generation).toBe(0)
  })

  it.skip(`Eve steals Bob's phone; Bob heals the team`, async () => {
    const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')
    await connect(alice, bob)
    // await connect(bob, charlie)

    expect(alice.team.adminKeys().generation).toBe(0)
    expect(alice.team.teamKeys().generation).toBe(0)

    // Bob invites his phone and it joins
    const { seed } = bob.team.invite({ deviceName: 'phone' })
    bob.phone.keys = generateStarterKeys({ type: DEVICE, name: getDeviceId(bob.phone) }, seed)
    await connectPhoneWithInvitation(bob, seed)

    // // Bob's laptop knows what's up
    // expect(bob.team.members('bob').devices).toHaveLength(2)
    // expect(bob.team.adminKeys().generation).toBe(1) // the keys have been rotated once
    // expect(bob.team.teamKeys().generation).toBe(1)

    // // Alice knows what's up
    // expect(alice.team.members('bob').devices).toHaveLength(2)
    // expect(alice.team.adminKeys().generation).toBe(1)
    // expect(alice.team.teamKeys().generation).toBe(1)

    // Eve steals Bob's phone.

    expect(bob.connection.alice.team).toBe(bob.team)

    // From his laptop, Bob removes his phone from the team

    bob.team.removeDevice('bob', 'phone')
    expect(bob.team.members('bob').devices).toHaveLength(1)

    // TODO: at this point Alice and Bob are no longer updating, so this times out:
    // await updated(alice, bob)

    // Alice can see that Bob only has one device
    expect(alice.team.members('bob').devices).toHaveLength(1)

    // // The keys have been rotated again
    // expect(charlie.team.adminKeys().generation).toBe(2)
    // expect(charlie.team.teamKeys().generation).toBe(2)

    // // Eve tries to connect to Charlie from Bob's phone, but she can't
    // const phoneContext = {
    //   device: bob.phone,
    //   user: bob.user,
    //   team: bob.team,
    // }

    // const join = joinTestChannel(new TestChannel())

    // const eveOnBobsPhone = join(phoneContext).start()
    // const heyCharlie = join(charlie.context).start()

    // // GRRR foiled again
    // await all([eveOnBobsPhone, heyCharlie], 'disconnected')
  })

  it.skip(`Eve steals Bob's laptop; Alice heals the team`, async () => {
    const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')
    await connect(alice, bob)
    await connect(alice, charlie)

    expect(alice.team.adminKeys().generation).toBe(0)
    expect(alice.team.teamKeys().generation).toBe(0)

    // Eve steals Bob's laptop, so Alice removes Bob's laptop from the team
    alice.team.removeDevice('bob', 'laptop')

    // Alice can see that Bob has no devices
    expect(alice.team.members('bob').devices).toHaveLength(0)

    // The keys have been rotated
    expect(charlie.team.adminKeys().generation).toBe(1)
    expect(charlie.team.teamKeys().generation).toBe(1)

    // Eve tries to connect to Charlie from Bob's laptop, but she can't
    connect(bob, charlie)
    // GRRR foiled again
    await disconnection(bob, charlie)

    // TODO: Figure out how to get Bob back onto team when his only device is compromised

    // - bob is a member
    // - but bob has no devices
    // - member invitation won't work, because he's already a member
    // - device invitation won't work, because you can only invite your own devices, and bob doesn't
    //   have a device to send an invite *from*
    //
    // options:
    // - Alice could remove him as user, then re-add
    // - could implement "paper keys"
    // -
  })

  it('allows Alice and Bob to send each other encrypted messages', async done => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
    await connect(alice, bob)

    // 👨🏻‍🦲 Bob sets up his message handler
    bob.connection.alice.once('message', receiveMessage)

    // 👩🏾 Alice sends a message
    alice.connection.bob.send('hello')

    // 👨🏻‍🦲 Bob receives it
    function receiveMessage(d: string) {
      expect(d).toEqual('hello')
      done()
    }
  })

  it('Alice promotes Bob then demotes him', async () => {
    const { alice, bob } = setup('alice', { user: 'bob', member: false })
    const { seed } = alice.team.invite({ userName: 'bob' })
    await connectWithInvitation(alice, bob, seed)

    // 👨🏻‍🦲 Bob is not an admin
    expect(bob.team.memberIsAdmin('bob')).toBe(false)

    // 👩🏾 Alice promotes Bob
    alice.team.addMemberRole('bob', ADMIN)
    await updated(alice, bob)

    // 👨🏻‍🦲 Bob sees that he is admin
    expect(bob.team.memberIsAdmin('bob')).toBe(true)

    // 👩🏾 Alice demotes Bob
    alice.team.removeMemberRole('bob', ADMIN)
    await updated(alice, bob)

    // 👨🏻‍🦲 Bob sees that he is no longer admin
    expect(bob.team.memberIsAdmin('bob')).toBe(false)
  })
})
