import { ADMIN } from '@/role'
import {
  any,
  anyDisconnected,
  anyUpdated,
  connect,
  connectPhoneWithInvitation,
  connectWithInvitation,
  disconnect,
  disconnection,
  expectEveryoneToKnowEveryone,
  joinTestChannel,
  setup,
  TestChannel,
  updated,
} from '@/util/testing'

describe('connection', () => {
  describe('sync', () => {
    describe('two peers', () => {
      it('knows when users are up to date', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)
      })

      it('updates remote user after connecting', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // at this point, Alice and Bob have the same signature chain

        // 👩🏾 but now Alice does some stuff
        alice.team.addRole('managers')
        alice.team.addMemberRole('bob', 'managers')

        expect(alice.team.hasRole('managers')).toBe(true)
        expect(alice.team.memberHasRole('bob', 'managers')).toBe(true)

        // 👨🏻‍🦲 Bob hasn't connected, so he doesn't have Alice's changes
        expect(bob.team.hasRole('managers')).toBe(false)
        expect(bob.team.memberHasRole('bob', 'managers')).toBe(false)

        // 👩🏾 👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // ✅ 👨🏻‍🦲 Bob is up to date with Alice's changes
        expect(bob.team.hasRole('managers')).toBe(true)
        expect(bob.team.memberHasRole('bob', 'managers')).toBe(true)
      })

      it('updates local user after connecting', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // at this point, Alice and Bob have the same signature chain

        // 👨🏻‍🦲 but now Bob does some stuff
        bob.team.addRole('managers')
        bob.team.addMemberRole('bob', 'managers')

        // 👩🏾 👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // ✅ 👩🏾 Alice is up to date with Bob's changes
        expect(alice.team.hasRole('managers')).toBe(true)
        expect(alice.team.memberHasRole('bob', 'managers')).toBe(true)
      })

      it('updates remote user while connected', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)
        // at this point, Alice and Bob have the same signature chain

        // 👨🏻‍🦲 now Alice does some stuff
        alice.team.addRole('managers')

        await anyUpdated(alice, bob)

        // ✅ 👩🏾 Bob is up to date with Alice's changes
        expect(bob.team.hasRole('managers')).toBe(true)
      })

      it('updates local user while connected', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // at this point, Alice and Bob have the same signature chain

        // 👨🏻‍🦲 now Bob does some stuff
        bob.team.addRole('managers')

        await anyUpdated(alice, bob)

        // ✅ 👩🏾 Alice is up to date with Bob's changes
        expect(alice.team.hasRole('managers')).toBe(true)
      })

      it('resolves concurrent non-conflicting changes when updating', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 Alice creates a new role
        expect(alice.team.hasRole('MANAGERS')).toBe(false)
        alice.team.addRole('MANAGERS')
        expect(alice.team.hasRole('MANAGERS')).toBe(true)

        // 👨🏻‍🦲 concurrently, Bob invites Charlie
        const { id } = bob.team.inviteMember()
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
    })

    describe('three or more peers', () => {
      it('sends updates across multiple hops', async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

        // 👩🏾 👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)
        await connect(bob, charlie)

        // at this point, Alice and Bob have the same signature chain

        // 👨🏻‍🦲 now Alice does some stuff
        alice.team.addRole('managers')
        alice.team.addMemberRole('bob', 'managers')

        await Promise.all([
          anyUpdated(alice, bob), //
          anyUpdated(bob, charlie),
        ])

        // ✅ 👩🏾 Bob is up to date with Alice's changes
        expect(bob.team.hasRole('managers')).toBe(true)

        // ✅ Charlie sees the new role, even though he's not connected directly to Alice 👳🏽‍♂️💭
        expect(charlie.team.hasRole('managers')).toBe(true)
      })

      it('syncs up three ways - changes made after connecting', async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

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

        await Promise.all([
          updated(alice, bob), //
          updated(bob, charlie), //
          updated(alice, charlie),
        ])

        // ✅ All three get the three new roles
        expect(bob.team.hasRole('ALICES_FRIENDS')).toBe(true)
        expect(charlie.team.hasRole('ALICES_FRIENDS')).toBe(true)
        expect(alice.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
        expect(bob.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
        expect(alice.team.hasRole('BOBS_FRIENDS')).toBe(true)
        expect(charlie.team.hasRole('BOBS_FRIENDS')).toBe(true)
      })

      it('syncs up three ways - changes made before connecting', async () => {
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

      it('syncs up three ways - duplicate changes', async () => {
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
    })

    describe('removals and demotions', () => {
      it('lets a member remove the founder', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // 👨🏻‍🦲 Bob removes Alice
        bob.team.remove('alice')

        // 👩🏾🔌👨🏻‍🦲 Alice is no longer a member, so they're disconnected
        await anyDisconnected(alice, bob)

        // ✅ Alice is no longer on the team 👩🏾👎
        expect(bob.team.has('alice')).toBe(false)
      })

      it('eventually updates disconnected members when someone uses an invitation to join', async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

        // 👩🏾📧👳🏽‍♂️ Alice invites Charlie
        const { seed } = alice.team.inviteMember()

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
        const { seed } = alice.team.inviteMember()

        await Promise.all([
          // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
          connectWithInvitation(alice, charlie, seed),
          // 👩🏾<->👨🏻‍🦲 Bob learns about Charlie from Alice
          anyUpdated(alice, bob),
        ])

        // ✅
        expectEveryoneToKnowEveryone(alice, charlie, bob)
      })

      it('resolves concurrent duplicate invitations when updating', async () => {
        const { alice, bob, charlie, dwight } = setup([
          'alice',
          'bob',
          { user: 'charlie', member: false },
          { user: 'dwight', member: false },
        ])

        // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie and Dwight
        const aliceInvitesCharlie = alice.team.inviteMember()
        const aliceInvitesDwight = alice.team.inviteMember() // invitation unused, but that's OK

        // 👨🏻‍🦲📧👳🏽‍♂️👴 concurrently, Bob invites Charlie and Dwight
        const bobInvitesCharlie = bob.team.inviteMember() // invitation unused, but that's OK
        const bobInvitesDwight = bob.team.inviteMember()

        // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, charlie, aliceInvitesCharlie.seed)

        // 👴📧<->👨🏻‍🦲 Dwight connects to Bob and uses his invitation to join
        await connectWithInvitation(bob, dwight, bobInvitesDwight.seed)

        // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // ✅ No problemo
        expectEveryoneToKnowEveryone(alice, charlie, bob, dwight)
      })

      it('resolves concurrent duplicate removals', async () => {
        const { alice, bob } = setup('alice', 'bob', 'charlie')

        // 👳🏽‍♂️ Charlie is a member
        expect(alice.team.has('charlie')).toBe(true)
        expect(bob.team.has('charlie')).toBe(true)

        // 👨🏻‍🦲 Bob removes 👳🏽‍♂️ Charlie
        bob.team.remove('charlie')
        expect(alice.team.has('charlie')).toBe(true)
        expect(bob.team.has('charlie')).toBe(false)

        // 👩🏾 concurrently, Alice also removes 👳🏽‍♂️ Charlie
        alice.team.remove('charlie')
        expect(alice.team.has('charlie')).toBe(false)
        expect(bob.team.has('charlie')).toBe(false)

        // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // ✅ nothing blew up, and Charlie has been removed on both sides 🚫👳🏽‍♂️
        expect(alice.team.has('charlie')).toBe(false)
        expect(bob.team.has('charlie')).toBe(false)
      })

      it('resolves mutual demotions in favor of the senior member', async () => {
        const { alice, bob } = setup('alice', 'bob')
        await connect(alice, bob)

        // Both are admins
        expect(alice.team.memberIsAdmin('alice')).toBe(true)
        expect(bob.team.memberIsAdmin('alice')).toBe(true)
        expect(alice.team.memberIsAdmin('bob')).toBe(true)
        expect(bob.team.memberIsAdmin('bob')).toBe(true)

        // they both go offline
        await disconnect(alice, bob)

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
      })

      it('gets both sides of the story in the case of mutual removals', async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

        // 👨🏻‍🦲 Bob removes 👩🏾 Alice
        bob.team.remove('alice')

        // 👩🏾 Alice concurrently removes 👨🏻‍🦲 Bob
        alice.team.remove('bob')

        // 👳🏽‍♂️<->👨🏻‍🦲 Charlie and Bob connect
        await connect(bob, charlie)

        // 👳🏽‍♂️💭 Charlie now knows that Bob has removed Alice
        expect(charlie.team.has('alice')).toBe(false)

        await disconnect(bob, charlie)

        // 👳🏽‍♂️<->👩🏾 Charlie and Alice connect

        // Even though Charlie now thinks Alice has been removed, he still syncs with her because
        // she might have more information, e.g. that Bob (who removed her) was concurrently removed
        await connect(charlie, alice)

        expect(charlie.team.has('alice')).toBe(true)
        expect(charlie.team.has('bob')).toBe(false)

        // ✅ Charlie is disconnected from Bob because Bob is no longer a member 👳🏽‍♂️🔌👨🏻‍🦲
        await disconnection(bob, charlie)
      })

      it(`when a member is demoted and makes concurrent admin-only changes, discards those changes`, async () => {
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

      it(`when a member is demoted and concurrently adds a device, the new device is kept`, async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
        alice.team.removeMemberRole('bob', ADMIN)

        // 👨🏻‍🦲💻📧📱 concurrently, on his laptop, Bob invites his phone
        const { seed } = bob.team.inviteDevice()

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

      it('when an invitation is discarded, also discard related admittance actions', async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

        // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
        alice.team.removeMemberRole('bob', ADMIN)

        // 👨🏻‍🦲 concurrently, Bob invites 👳🏽‍♂️ Charlie and admits him to the team
        const { seed } = bob.team.inviteMember()
        await connectWithInvitation(bob, charlie, seed)

        expect(bob.team.has('charlie')).toBe(true)

        // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // ✅ Bob's invitation is discarded, because Bob concurrently lost admin privileges
        expect(alice.team.has('charlie')).toBe(false)
        expect(bob.team.has('charlie')).toBe(false)
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
        await Promise.all([
          connect(dwight, alice), //
          connect(dwight, bob),
          connect(dwight, charlie),
        ])

        const isAdmin = dwight.team.memberIsAdmin

        // Bob is no longer an admin
        expect(isAdmin('bob')).toBe(false)

        // Alice is still an admin (because seniority)
        expect(isAdmin('alice')).toBe(true)

        // Charlie is still an admin (because Bob demoted him while being demoted)
        expect(isAdmin('charlie')).toBe(true)
      })

      it('Alice promotes Bob then demotes him', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', admin: false })
        await connect(alice, bob)

        // 👨🏻‍🦲 Bob is not an admin
        expect(bob.team.memberIsAdmin('bob')).toBe(false)

        // 👩🏾 Alice promotes Bob
        alice.team.addMemberRole('bob', ADMIN)

        await anyUpdated(alice, bob)

        // 👨🏻‍🦲 Bob sees that he is admin
        expect(bob.team.memberIsAdmin('bob')).toBe(true)

        // 👩🏾 Alice demotes Bob
        alice.team.removeMemberRole('bob', ADMIN)
        await anyUpdated(alice, bob)

        // 👨🏻‍🦲 Bob sees that he is no longer admin
        expect(alice.team.memberIsAdmin('bob')).toBe(false)
        expect(bob.team.memberIsAdmin('bob')).toBe(false)
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
        await anyDisconnected(alice, bob)

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
        await anyUpdated(alice, bob)

        // 👨🏻‍🦲 Bob no longer has admin keys
        expect(() => bob.team.adminKeys()).toThrow()

        // The admin keys have been rotated
        expect(alice.team.adminKeys().generation).toBe(1)

        // The team keys haven't been rotated because Bob wasn't removed from the team
        expect(alice.team.teamKeys().generation).toBe(0)
      })

      it('decrypts new links received following a key rotation (upon connecting)', async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

        await connect(alice, bob)

        // 👩🏾 Alice removes Bob from the team
        alice.team.remove('bob')
        await anyDisconnected(alice, bob)

        // The team keys have been rotated
        expect(alice.team.teamKeys().generation).toBe(1)

        // Alice does something else — say she creates a new role
        // This will now be encrypted with the new team keys
        alice.team.addRole('managers')

        await connect(alice, charlie)

        // Charlie can decrypt the last link Alice created
        expect(charlie.team.hasRole('managers')).toBe(true)
      })

      it('decrypts new links received following a key rotation (while connected)', async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

        await connect(alice, bob)
        await connect(alice, charlie)

        // 👩🏾 Alice removes Bob from the team
        alice.team.remove('bob')
        await anyDisconnected(alice, bob)

        // The team keys have been rotated
        expect(alice.team.teamKeys().generation).toBe(1)

        // Alice does something else — say she creates a new role
        // This will now be encrypted with the new team keys
        alice.team.addRole('managers')

        // HACK: this only works if we wait for two `updated` events - not sure why
        await anyUpdated(alice, charlie)
        await anyUpdated(alice, charlie)

        // Charlie can decrypt the last link Alice created
        expect(charlie.team.hasRole('managers')).toBe(true)
      })

      it('unwinds an invalidated admission', async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })
        expect(alice.team.adminKeys().generation).toBe(0)

        // while disconnected...
        // Alice demotes Bob
        alice.team.removeMemberRole('bob', ADMIN)
        // the admin keys are rotated
        expect(alice.team.adminKeys().generation).toBe(1)

        // Bob invites Charlie & Charlie joins
        const { seed } = bob.team.inviteMember()
        await connectWithInvitation(bob, charlie, seed)

        // then...
        // Alice and Bob connect
        await connect(alice, bob)

        // Charlie's admission is invalidated
        expect(alice.team.has('charlie')).toBe(false)
        expect(bob.team.has('charlie')).toBe(false)

        // Alice rotates the team keys
        expect(alice.team.teamKeys().generation).toBe(1)
        // and all other keys, for good measure
        expect(alice.team.adminKeys().generation).toBe(2)
      })
    })

    describe('post-compromise recovery', () => {
      it(`Eve steals Bob's phone; Bob heals the team`, async () => {
        const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')
        await connect(alice, bob)
        await connect(bob, charlie)

        // Bob invites his phone and it joins
        const { seed } = bob.team.inviteDevice()
        await Promise.all([
          connectPhoneWithInvitation(bob, seed), //
          anyUpdated(alice, bob),
        ])

        // Bob and Alice know about Bob's phone
        expect(bob.team.members('bob').devices).toHaveLength(2)
        expect(alice.team.members('bob').devices).toHaveLength(2)

        // Eve steals Bob's phone.

        // From his laptop, Bob removes his phone from the team
        bob.team.removeDevice('bob', 'phone')
        expect(bob.team.members('bob').devices).toHaveLength(1)

        // Alice can see that Bob only has one device
        await anyUpdated(alice, bob)
        expect(alice.team.members('bob').devices).toHaveLength(1)

        await anyUpdated(bob, charlie)
        expect(charlie.team.members('bob').devices).toHaveLength(1)

        // Eve tries to connect to Charlie from Bob's phone, but she can't
        const phoneContext = {
          device: bob.phone,
          user: bob.user,
          team: bob.team,
          teamKeys: bob.team.teamKeys(),
          // TODO why are we passing teamkeys if we can just get them from team
        }

        const join = joinTestChannel(new TestChannel())

        const eveOnBobsPhone = join(phoneContext).start()
        const heyCharlie = join(charlie.connectionContext).start()

        // GRRR foiled again
        await any([eveOnBobsPhone, heyCharlie], 'disconnected')
      })

      it.todo(`Eve steals Bob's laptop; Alice heals the team`) //, async () => {
      //   const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')
      //   await connect(alice, bob)
      //   await connect(alice, charlie)
      //   expect(alice.team.adminKeys().generation).toBe(0)
      //   expect(alice.team.teamKeys().generation).toBe(0)

      //   // Eve steals Bob's laptop, so Alice removes Bob's laptop from the team
      //   alice.team.removeDevice('bob', 'laptop')

      //   // Alice can see that Bob has no devices
      //   expect(alice.team.members('bob').devices).toHaveLength(0)

      //   await updated(alice, charlie)

      //   // The keys have been rotated
      //   expect(charlie.team.adminKeys().generation).toBe(1)
      //   expect(charlie.team.teamKeys().generation).toBe(1)

      //   // Eve tries to connect to Charlie from Bob's laptop, but she can't
      //   connect(bob, charlie)

      //   // GRRR foiled again
      //   await disconnection(bob, charlie)

      //   const { seed } = alice.team.inviteDevice()

      //   const phoneContext = {
      //     userName: bob.userName,
      //     device: bob.phone,
      //     invitationSeed: seed,
      //   } as InviteeDeviceInitialContext

      //   const join = joinTestChannel(new TestChannel())

      //   const aliceBobPhone = await join(alice.connectionContext).start()
      //   const bobPhone = await join(phoneContext).start()

      //   await all([aliceBobPhone, bobPhone], 'connected')

      //   // TODO: This will require a distinct workflow. Alice can't admit Bob's device because she's not Bob.
      //   // When a user admits their own device, they create a lockbox for the device so that it has the user keys.
      //   // In this case, Bob's old user keys are gone forever, so the device needs to be able to generate new ones.
      // })
    })
  })
})
