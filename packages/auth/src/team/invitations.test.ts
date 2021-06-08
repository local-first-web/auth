import * as devices from '@/device'
import * as keysets from '@/keyset'
import { getDeviceId } from '@/device'
import { generateProof, ProofOfInvitation } from '@/invitation'
import { ADMIN } from '@/role'
import * as teams from '@/team'
import { setup } from '@/util/testing'
import { KeyType } from '@/keyset'
import { generateStarterKeys } from '@/invitation/generateStarterKeys'

const { MEMBER, DEVICE } = KeyType
describe('Team', () => {
  describe('invitations', () => {
    describe('members', () => {
      const bobKeys = keysets.create({ type: MEMBER, name: 'bob' })
      const bobPublicKeys = keysets.redactKeys(bobKeys)

      const charlieKeys = keysets.create({ type: MEMBER, name: 'charlie' })
      const charliePublicKeys = keysets.redactKeys(charlieKeys)

      it('accepts valid proof of invitation', () => {
        const { alice } = setup('alice')

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.invite()

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in, associating
        // him with the public keys he's provided
        alice.team.admit(proofOfInvitation, bobPublicKeys)

        // ✅ 👨🏻‍🦲 Bob is now on the team. Congratulations, Bob!
        expect(alice.team.has('bob')).toBe(true)
      })

      it('lets you use a key of your choosing', () => {
        const { alice } = setup('alice')

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a secret key of her choosing
        const seed = 'passw0rd'
        alice.team.invite({ seed })

        const proofOfInvitation = generateProof(seed)
        alice.team.admit(proofOfInvitation, bobPublicKeys)

        // ✅ Still works
        expect(alice.team.has('bob')).toBe(true)
      })

      it('normalizes the secret key', () => {
        const { alice } = setup('alice')

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob
        const seed = 'abc def ghi'
        alice.team.invite({ userName: 'bob', seed })

        // 👨🏻‍🦲 Bob accepts the invitation using a url-friendlier version of the key
        const proofOfInvitation = generateProof('abc+def+ghi')
        alice.team.admit(proofOfInvitation, bobPublicKeys)

        // ✅ Bob is on the team
        expect(alice.team.has('bob')).toBe(true)
      })

      it('allows non-admins to accept an invitation', () => {
        let { alice, bob } = setup('alice', { user: 'bob', admin: false })

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed } = alice.team.invite()

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        let persistedTeam = alice.team.save()
        const bobsTeam = teams.load(persistedTeam, bob.localContext)

        // just to confirm: 👨🏻‍🦲 Bob isn't an admin
        expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        bobsTeam.admit(proofOfInvitation, charliePublicKeys)

        // 👍👳🏽‍♂️ Charlie is now on the team
        expect(bobsTeam.has('charlie')).toBe(true)

        // ✅ 👩🏾 Alice can now see that 👳🏽‍♂️ Charlie is on the team. Congratulations, Charlie!
        persistedTeam = bobsTeam.save()
        alice.team = teams.load(persistedTeam, alice.localContext)
        expect(alice.team.has('charlie')).toBe(true)
      })

      it('allows revoking an invitation', () => {
        let { alice, bob } = setup('alice', 'bob')

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed, id } = alice.team.invite()

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 👩🏾 Alice changes her mind and revokes the invitation
        alice.team.revokeInvitation(id)

        // later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        const persistedTeam = alice.team.save()
        bob.team = teams.load(persistedTeam, bob.localContext)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        const tryToAdmitCharlie = () => bob.team.admit(proofOfInvitation, charliePublicKeys)

        // 👎 But the invitation is rejected
        expect(tryToAdmitCharlie).toThrowError(/revoked/)

        // ✅ 👳🏽‍♂️ Charlie is not on the team
        expect(bob.team.has('charlie')).toBe(false)
      })
    })

    describe('devices', () => {
      // it('creates and accepts an invitation for a device', () => {
      //   const { alice } = setup('alice')
      //   const deviceName = 'alicez phone'
      //   // 👩🏾 Alice only has 💻 one device on the signature chain
      //   expect(alice.team.members('alice').devices).toHaveLength(1)
      //   // 💻 on her laptop, Alice generates an invitation for her phone
      //   const { seed } = alice.team.invite({ deviceName })
      //   // 📱 Alice gets the seed to her phone, perhaps by typing it in or by scanning a QR code.
      //   // Alice's phone uses the seed to generate her starter keys and her proof of invitation
      //   const phone = devices.create('alice', deviceName)
      //   const deviceId = getDeviceId(phone)
      //   phone.keys = generateStarterKeys({ type: DEVICE, name: deviceId }, seed)
      //   const proofOfInvitation = generateProof(seed, { type: DEVICE, name: deviceId })
      //   // 📱 Alice's phone connects with 💻 her laptop and presents the proof
      //   alice.team.admit(proofOfInvitation)
      //   // 👍 The proof was good, so the laptop sends the phone the team's signature chain
      //   const savedTeam = alice.team.save()
      //   const phoneTeam = teams.load(savedTeam, { device: phone })
      //   // 📱 Alice's phone joins the team
      //   const { user, device } = phoneTeam.join(proofOfInvitation, seed)
      //   // ✅ Now Alice has 💻📱 two devices on the signature chain
      //   expect(phoneTeam.members('alice').devices).toHaveLength(2)
      // })
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
