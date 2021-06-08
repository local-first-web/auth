import * as devices from '@/device'
import { getDeviceId } from '@/device'
import { generateProof } from '@/invitation'
import * as keysets from '@/keyset'
import { KeyType } from '@/keyset'
import * as teams from '@/team'
import { setup } from '@/util/testing'

const { MEMBER, DEVICE } = KeyType
describe('Team', () => {
  describe('invitations', () => {
    describe('members', () => {
      it('accepts valid proof of invitation', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in, associating
        // him with the public keys he's provided
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.device.keys)

        // ✅ 👨🏻‍🦲 Bob is now on the team. Congratulations, Bob!
        expect(alice.team.has('bob')).toBe(true)
      })

      it('lets you use a key of your choosing', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a secret key of her choosing
        const seed = 'passw0rd'
        alice.team.inviteMember({ seed })

        const proofOfInvitation = generateProof(seed)

        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.device.keys)

        // ✅ Still works
        expect(alice.team.has('bob')).toBe(true)
      })

      it('normalizes the secret key', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob
        const seed = 'abc def ghi'
        alice.team.inviteMember({ seed })

        // 👨🏻‍🦲 Bob accepts the invitation using a url-friendlier version of the key
        const proofOfInvitation = generateProof('abc+def+ghi')
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.device.keys)

        // ✅ Bob is on the team
        expect(alice.team.has('bob')).toBe(true)
      })

      it('allows non-admins to accept an invitation', () => {
        let { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', member: false }
        )

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed } = alice.team.inviteMember()

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        let persistedTeam = alice.team.save()
        const bobsTeam = teams.load(persistedTeam, bob.localContext)

        // just to confirm: 👨🏻‍🦲 Bob isn't an admin
        expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        bobsTeam.admitMember(proofOfInvitation, charlie.user.keys, charlie.device.keys)

        // 👍👳🏽‍♂️ Charlie is now on the team
        expect(bobsTeam.has('charlie')).toBe(true)

        // ✅ 👩🏾 Alice can now see that 👳🏽‍♂️ Charlie is on the team. Congratulations, Charlie!
        persistedTeam = bobsTeam.save()
        alice.team = teams.load(persistedTeam, alice.localContext)
        expect(alice.team.has('charlie')).toBe(true)
      })

      it(`will use an invitation that hasn't expired yet`, () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob with a future expiration date
        const expiration = new Date(Date.UTC(2999, 12, 25)).valueOf() // NOTE 👩‍🚀 this test will fail if run in the distant future
        const { seed } = alice.team.inviteMember({ expiration })
        const proofOfInvitation = generateProof(seed)
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.device.keys)

        // ✅ 👨🏻‍🦲 Bob's invitation has not expired so he is on the team
        expect(alice.team.has('bob')).toBe(true)
      })

      it(`won't use an expired invitation`, () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // A long time ago 👩🏾 Alice invited 👨🏻‍🦲 Bob
        const expiration = new Date(Date.UTC(2020, 12, 25)).valueOf()
        const { seed } = alice.team.inviteMember({ expiration })
        const proofOfInvitation = generateProof(seed)

        const tryToAdmitBob = () =>
          alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.device.keys)

        // 👎 👨🏻‍🦲 Bob's invitation has expired so he can't get in
        expect(tryToAdmitBob).toThrowError(/expired/)

        // ❌ 👨🏻‍🦲 Bob is not on the team
        expect(alice.team.has('bob')).toBe(false)
      })

      it(`can use an invitation multiple times`, () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        const { seed } = alice.team.inviteMember({ maxUses: 2 })

        // 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie both generate the same proof of invitation from the seed
        const proofOfInvitation = generateProof(seed)

        // 👩🏾 Alice admits them both

        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.device.keys)
        alice.team.admitMember(proofOfInvitation, charlie.user.keys, charlie.device.keys)

        // ✅ 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie are both on the team
        expect(alice.team.has('bob')).toBe(true)
        expect(alice.team.has('charlie')).toBe(true)
      })

      it(`won't use an invitation more than the maximum uses defined`, () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        const { seed } = alice.team.inviteMember({ maxUses: 1 })

        // 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie both generate the same proof of invitation from the seed
        const proofOfInvitation = generateProof(seed)

        const tryToAdmitBob = () =>
          alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.device.keys)
        const tryToAdmitCharlie = () =>
          alice.team.admitMember(proofOfInvitation, charlie.user.keys, charlie.device.keys)

        // 👍 👨🏻‍🦲 Bob uses the invitation first and he gets in
        expect(tryToAdmitBob).not.toThrow()

        // 👎 👳🏽‍♂️ Charlie also tries to use the invitation, but it can only be used once
        expect(tryToAdmitCharlie).toThrow(/used/)

        // ✅ 👨🏻‍🦲 Bob is on the team
        expect(alice.team.has('bob')).toBe(true)

        // ❌ 👳🏽‍♂️ Charlie is not on the team
        expect(alice.team.has('charlie')).toBe(false)
      })

      it(`won't use a revoked invitation`, () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', member: false }
        )

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed, id } = alice.team.inviteMember()

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 👩🏾 Alice changes her mind and revokes the invitation
        alice.team.revokeInvitation(id)

        // later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        const persistedTeam = alice.team.save()
        bob.team = teams.load(persistedTeam, bob.localContext)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        const tryToAdmitCharlie = () =>
          bob.team.admitMember(proofOfInvitation, charlie.user.keys, charlie.device.keys)

        // 👎 But the invitation is rejected because it was revoked
        expect(tryToAdmitCharlie).toThrowError(/revoked/)

        // ❌ 👳🏽‍♂️ Charlie is not on the team
        expect(bob.team.has('charlie')).toBe(false)
      })
    })

    describe('devices', () => {
      it('creates and accepts an invitation for a device', () => {
        const { alice } = setup('alice')

        // 👩🏾 Alice only has 💻 one device on the signature chain
        expect(alice.team.members('alice').devices).toHaveLength(1)

        // 💻 on her laptop, Alice generates an invitation for her phone
        const { seed } = alice.team.inviteDevice()

        // 📱 Alice gets the seed to her phone, perhaps by typing it in or by scanning a QR code.

        // Alice's phone uses the seed to generate her starter keys and her proof of invitation
        const proofOfInvitation = generateProof(seed)

        // 📱 Alice's phone connects with 💻 her laptop and presents the proof
        alice.team.admitDevice(proofOfInvitation, 'alice', alice.phone.keys)

        // 👍 The proof was good, so the laptop sends the phone the team's signature chain
        const savedTeam = alice.team.save()
        const phoneTeam = teams.load(savedTeam, { device: alice.phone })

        // 📱 Alice's phone joins the team
        const { user, device } = phoneTeam.join(proofOfInvitation, seed)

        // ✅ Now Alice has 💻📱 two devices on the signature chain
        expect(phoneTeam.members('alice').devices).toHaveLength(2)
        expect(alice.team.members('alice').devices).toHaveLength(2)
      })

      // it('allows revoking an invitation', () => {
      //   let { alice, bob } = setup('alice', 'bob')
      //   const deviceName = 'alicez phone'
      //   // 👩🏾 Alice only has 💻 one device on the signature chain
      //   expect(alice.team.members('alice').devices).toHaveLength(1)
      //   // 💻 on her laptop, Alice generates an invitation for her phone
      //   const { id, seed } = alice.team.invite({ deviceName })
      //   expect(alice.team.members('alice').devices).toHaveLength(2)
      //   // 📱 Alice gets the seed to her phone, perhaps by typing it in or by scanning a QR code.
      //   // Alice's phone uses the seed to generate her starter keys and her proof of invitation
      //   const phone = devices.create('alice', deviceName)
      //   const deviceId = getDeviceId(phone)
      //   phone.keys = generateStarterKeys({ type: DEVICE, name: deviceId }, seed)
      //   const proofOfInvitation = generateProof(seed, { type: DEVICE, name: deviceId })
      //   // 👩🏾 Alice changes her mind and revokes the invitation
      //   alice.team.revokeInvitation(id)
      //   expect(alice.team.members('alice').devices).toHaveLength(1)
      // })
    })
  })
})
