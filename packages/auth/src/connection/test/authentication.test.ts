import { ADMIN } from 'role/index.js'
import * as teams from 'team/index.js'
import {
  TestChannel,
  all,
  anyDisconnected,
  anyUpdated,
  connect,
  connectWithInvitation,
  disconnect,
  disconnection,
  expectEveryoneToKnowEveryone,
  joinTestChannel,
  setup,
  tryToConnect,
} from 'util/testing/index.js'
import { describe, expect, it } from 'vitest'
import type { InviteeDeviceContext } from '../types.js'
import { pause } from 'util/testing/pause.js'

describe('connection', () => {
  describe('authentication', () => {
    describe('with known members', () => {
      it('connects two members', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
        await connect(alice, bob)

        // 👩🏾 👨🏻‍🦲 Alice and Bob both leave the channel
        await disconnect(alice, bob)
      })

      it("doesn't connect with a member who has been removed", async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 Alice removes Bob
        alice.team.remove(bob.userId)

        // ❌ They can't connect because Bob was removed
        void tryToConnect(alice, bob)
        await anyDisconnected(alice, bob)
      })

      it("doesn't connect with someone who doesn't belong to the team", async () => {
        const { alice, charlie } = setup('alice', 'bob', {
          user: 'charlie',
          member: false,
        })

        charlie.connectionContext = {
          team: teams.createTeam('team charlie', {
            device: charlie.device,
            user: charlie.user,
          }),
          userName: 'charlie',
          user: charlie.user,
          device: charlie.device,
        }

        // ❌ Alice and Charlie can't connect because they're on different teams
        void tryToConnect(alice, charlie)
        await anyDisconnected(alice, charlie)
      })

      it('can reconnect after disconnecting', async () => {
        const { alice, bob } = setup('alice', 'bob')
        // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // 👩🏾🔌👨🏻‍🦲 Alice disconnects
        await disconnect(alice, bob)

        // 👩🏾<->👨🏻‍🦲 Alice reconnects
        await connect(alice, bob)

        // ✅ all good
      })
    })

    describe('with invitations', () => {
      it('connects an invitee with a member', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, bob, seed)

        // ✅
        expectEveryoneToKnowEveryone(alice, bob)
      })

      it('alice invites bob then bob invites charlie', async () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const { seed: bobSeed } = alice.team.inviteMember()

        // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, bob, bobSeed)
        expectEveryoneToKnowEveryone(alice, bob)

        // Alice promotes Bob
        alice.team.addMemberRole(bob.userId, ADMIN)
        await anyUpdated(alice, bob)

        // Bob invites Charlie
        const { seed: charlieSeed } = bob.team.inviteMember()

        // Charlie connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, charlie, charlieSeed)

        // ✅
        expectEveryoneToKnowEveryone(alice, bob, charlie)
      })

      it('after being admitted, invitee has team keys', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, bob, seed)

        // Update the team from the connection, which should have the new keys
        const connection = bob.connection[alice.deviceId]
        bob.team = connection.team!

        // 👨🏻‍🦲 Bob has the team keys
        expect(() => bob.team.teamKeys()).not.toThrow()
      })

      it("doesn't allow two invitees to connect", async () => {
        const { alice, charlie, dwight } = setup([
          'alice',
          { user: 'charlie', member: false },
          { user: 'dwight', member: false },
        ])

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie
        const { seed: charlieSeed } = alice.team.inviteMember()
        charlie.connectionContext = {
          ...charlie.connectionContext,
          invitationSeed: charlieSeed,
        }

        // 👩🏾 Alice invites 👴 Dwight
        const { seed: dwightSeed } = alice.team.inviteMember()
        dwight.connectionContext = {
          ...dwight.connectionContext,
          invitationSeed: dwightSeed,
        }

        // 👳🏽‍♂️<->👴 Charlie and Dwight try to connect to each other
        void connect(charlie, dwight)

        // ✅ ❌ They're unable to connect because at least one needs to be a member
        await disconnection(charlie, dwight, 'peer is also holding an invitation')
      })

      it('lets a member use an invitation to add a device', async () => {
        const { alice, bob } = setup('alice', 'bob')

        await connect(alice, bob)

        expect(bob.team.members(bob.userId).devices).toHaveLength(1)

        // 👨🏻‍🦲💻📧->📱 on his laptop, Bob creates an invitation and gets it to his phone
        const { seed } = bob.team.inviteDevice()

        // 💻<->📱📧 Bob's phone and laptop connect and the phone joins
        const phoneContext: InviteeDeviceContext = {
          userName: bob.userName,
          device: bob.phone!,
          invitationSeed: seed,
        }
        const join = joinTestChannel(new TestChannel())

        const laptopConnection = join(bob.connectionContext).start()
        const phoneConnection = join(phoneContext).start()

        await all([laptopConnection, phoneConnection], 'connected')

        bob.team = laptopConnection.team!

        // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
        expect(bob.team.members(bob.userId).devices).toHaveLength(2)

        // ✅ 👩🏾👍📱 Alice knows about Bob's phone
        expect(alice.team.members(bob.userId).devices).toHaveLength(2)
      })

      it('lets a member invite a device, remove it, and then add it back', async () => {
        const { alice, bob } = setup('alice', 'bob')
        await connect(alice, bob)

        // Bob invites and admits his phone

        const phone = bob.phone!

        {
          const { seed } = bob.team.inviteDevice()
          const phoneContext: InviteeDeviceContext = {
            userName: bob.userName,
            device: phone,
            invitationSeed: seed,
          }
          const join = joinTestChannel(new TestChannel())
          const laptopConnection = join(bob.connectionContext).start()
          const phoneConnection = join(phoneContext).start()
          await all([laptopConnection, phoneConnection], 'connected')

          bob.team = laptopConnection.team!

          expect(bob.team.members(bob.userId).devices).toHaveLength(2)
          expect(alice.team.members(bob.userId).devices).toHaveLength(2)

          // Bob removes his phone
          laptopConnection.stop()
          bob.team.removeDevice(phone.deviceId)
          await anyUpdated(alice, bob)
          await pause(50)

          expect(bob.team.members(bob.userId).devices).toHaveLength(1)
          expect(alice.team.members(bob.userId).devices).toHaveLength(1)
        }
        {
          // Bob invites his phone again

          const { seed } = bob.team.inviteDevice()
          const phoneContext: InviteeDeviceContext = {
            userName: bob.userName,
            device: phone,
            invitationSeed: seed,
          }
          const join = joinTestChannel(new TestChannel())
          const laptopConnection = join(bob.connectionContext).start()
          const phoneConnection = join(phoneContext).start()
          await all([laptopConnection, phoneConnection], 'connected')

          bob.team = laptopConnection.team!

          expect(bob.team.members(bob.userId).devices).toHaveLength(2)
          expect(alice.team.members(bob.userId).devices).toHaveLength(2)
        }
      })

      it('lets a different member admit an invited device', async () => {
        const { alice, bob } = setup('alice', 'bob')

        await connect(alice, bob)

        expect(bob.team.members(bob.userId).devices).toHaveLength(1)

        // 👨🏻‍🦲💻📧->📱 on his laptop, Bob creates an invitation and gets it to his phone
        const { seed } = bob.team.inviteDevice()

        // 💻<->📱📧 Bob's phone and Alice's laptop connect and the phone joins
        const phoneContext: InviteeDeviceContext = {
          userName: bob.userName,
          device: bob.phone!,
          invitationSeed: seed,
        }
        const join = joinTestChannel(new TestChannel())
        const aliceConnection = join(alice.connectionContext).start()
        const bobPhoneConnection = join(phoneContext).start()

        await all([aliceConnection, bobPhoneConnection], 'connected')

        alice.team = aliceConnection.team!

        // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
        expect(alice.team.members(bob.userId).devices).toHaveLength(2)

        // ✅ 👩🏾👍📱 Alice knows about Bob's phone
        expect(alice.team.members(bob.userId).devices).toHaveLength(2)
      })

      it('connects an invitee after one failed attempt', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const seed = 'passw0rd'
        alice.team.inviteMember({ seed })

        // 👨🏻‍🦲📧<->👩🏾 Bob tries to connect, but mistypes his code
        bob.connectionContext = {
          ...bob.connectionContext,
          invitationSeed: 'password',
        }

        void connect(bob, alice)

        // ❌ The connection fails
        await disconnection(alice, bob)

        // 👨🏻‍🦲📧<->👩🏾 Bob tries again with the right code this time
        bob.connectionContext = {
          ...bob.connectionContext,
          invitationSeed: 'passw0rd',
        }

        // ✅ that works
        await connect(bob, alice)
        bob.team = bob.connection[alice.deviceId].team!

        expectEveryoneToKnowEveryone(alice, bob)
      })
    })
  })
})
