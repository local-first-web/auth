import { clone } from '/chain'
import { LocalUserContext } from '/context'
import * as devices from '/device'
import { DeviceType } from '/device'
import { generateProof, ProofOfInvitation } from '/invitation'
import { ADMIN } from '/role'
import * as teams from '/team'
import * as user from '/user'
import { alice, alicesContext, bob, bobsContext, defaultContext, newTeam } from '/util/testing'

describe('Team', () => {
  const setup = () => ({
    team: newTeam(),
    context: defaultContext,
  })

  describe('invitations', () => {
    describe('members', () => {
      it('accepts valid proof of invitation', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { invitationSeed } = alicesTeam.invite('bob')

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(invitationSeed, 'bob')

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in
        alicesTeam.admit(proofOfInvitation)

        // ✅ 👨🏻‍🦲 Bob is now on the team. Congratulations, Bob!
        expect(alicesTeam.has('bob')).toBe(true)
      })

      it('lets you use a key of your choosing', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a secret key of her choosing
        const invitationSeed = 'passw0rd'
        alicesTeam.invite('bob', { invitationSeed })

        const proofOfInvitation = generateProof(invitationSeed, 'bob')
        alicesTeam.admit(proofOfInvitation)

        // ✅ Still works
        expect(alicesTeam.has('bob')).toBe(true)
      })

      it('normalizes the secret key', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob
        const invitationSeed = 'abc def ghi'
        alicesTeam.invite('bob', { invitationSeed })

        // 👨🏻‍🦲 Bob accepts the invitation using a url-friendlier version of the key
        const proofOfInvitation = generateProof('abc+def+ghi', 'bob')
        alicesTeam.admit(proofOfInvitation)

        // ✅ Bob is on the team
        expect(alicesTeam.has('bob')).toBe(true)
      })

      it('supports including roles in the invitation', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob as admin
        const { invitationSeed } = alicesTeam.invite('bob', { roles: [ADMIN] })

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(invitationSeed, 'bob')
        alicesTeam.admit(proofOfInvitation)

        // ✅ Bob is on the team as an admin 👍
        expect(alicesTeam.memberIsAdmin('bob')).toBe(true)
      })

      it('rejects invitation if name is altered', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob
        const { invitationSeed } = alicesTeam.invite('bob')

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(invitationSeed, 'bob')

        // 🦹‍♀️ Eve intercepts the invitation and tries to use it by swapping out Bob's name for hers
        const forgedProofOfInvitation: ProofOfInvitation = { ...proofOfInvitation, userName: 'eve' }

        // 🦹‍♀️ Eve shows 👩🏾 Alice her fake proof of invitation
        const presentForgedInvitation = () => alicesTeam.admit(forgedProofOfInvitation)

        // ✅ but 👩🏾 Alice is not fooled 👎
        expect(presentForgedInvitation).toThrow(/User names don't match/)
      })

      it('allows non-admins to accept an invitation', () => {
        let { team: alicesTeam } = setup()
        alicesTeam.add(bob) // bob is not an admin

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { invitationSeed } = alicesTeam.invite('charlie')

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(invitationSeed, 'charlie')

        // later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        let persistedTeam = alicesTeam.save()
        const bobsTeam = teams.load(persistedTeam, bobsContext)

        // just to confirm: 👨🏻‍🦲 Bob isn't an admin
        expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        bobsTeam.admit(proofOfInvitation)

        // 👍👳🏽‍♂️ Charlie is now on the team
        expect(bobsTeam.has('charlie')).toBe(true)

        // ✅ 👩🏾 Alice can now see that 👳🏽‍♂️ Charlie is on the team. Congratulations, Charlie!
        persistedTeam = bobsTeam.save()
        alicesTeam = teams.load(persistedTeam, alicesContext)
        expect(alicesTeam.has('charlie')).toBe(true)
      })

      it('allows the invitee to encrypt a message so they can update their keys', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a secret key of her choosing
        const invitationSeed = 'passw0rd'
        alicesTeam.invite('bob', { invitationSeed })

        const proofOfInvitation = generateProof(invitationSeed, 'bob')
        alicesTeam.admit(proofOfInvitation)

        // 👨🏻‍🦲 Bob uses the seed from 👩🏾 Alice to instantiate the team using his temporary key.
        // The team chain contains lockboxes that were encrypted using this key.
        const bob = user.create({
          userName: 'bob', 
          seed: invitationSeed,
          deviceName: 'laptop',
          deviceType: DeviceType.laptop
        })
        const bobsTeam = new teams.Team({
          source: alicesTeam.chain,
          context: {user: bob}
        })

        // 👨🏻‍🦲 Bob tries to encrypt a message using his temporary keys
        // so he can append to the chain with his new set of keys.
        const tryToEncryptMessage = () => bobsTeam.encrypt('Hello! Here are my real keys')

        // ✅ The message is encrypted so that it can be sent
        expect(tryToEncryptMessage).not.toThrowError()
      })

      it('allows revoking an invitation', () => {
        let { team: alicesTeam } = setup()
        alicesTeam.add(bob)

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { invitationSeed, id } = alicesTeam.invite('charlie')

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(invitationSeed, 'charlie')

        // 👩🏾 Alice changes her mind and revokes the invitation
        alicesTeam.revokeInvitation(id)
        alicesTeam.remove('charlie') // we now have to do this explicitly

        // TODO: should revoking implicitly remove the member? See Team.ts:revokeInvitation

        // later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        const persistedTeam = alicesTeam.save()
        const bobsTeam = teams.load(persistedTeam, bobsContext)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        const tryToAdmitCharlie = () => bobsTeam.admit(proofOfInvitation)

        // 👎 But the invitation is rejected
        expect(tryToAdmitCharlie).toThrowError(/revoked/)

        // ✅ 👳🏽‍♂️ Charlie is not on the team
        expect(bobsTeam.has('charlie')).toBe(false)
      })
    })

    describe('devices', () => {
      it('creates and accepts an invitation for a device', () => {
        const { team: laptopTeam } = setup()

        const phone = devices.create({
          userName: 'alice',
          deviceName: 'phone',
          type: DeviceType.mobile,
        })
        const phoneContext: LocalUserContext = { user: { ...alice, device: phone } }

        // 👩🏾 Alice only has 💻 one device on the signature chain
        expect(laptopTeam.members('alice').devices).toHaveLength(1)

        // 💻 on her laptop, Alice generates an invitation for herself (so a device invitation)
        const { invitationSeed } = laptopTeam.invite('alice')

        // 📱 Alice gets the invitationSeed to her phone, perhaps by typing it in or by scanning a QR code.
        // Alice's phone uses the invitationSeed to generate proof of invitation
        const proofOfInvitation = generateProof(invitationSeed, 'alice')

        // 📱 Alice's phone connects with 💻 her laptop and presents the proof
        laptopTeam.admit(proofOfInvitation)

        // 👍 The proof was good, so the laptop sends the phone the team's signature chain
        const phoneTeam = teams.load(clone(laptopTeam.chain), phoneContext)

        // 📱 Alice's phone "joins" the team (adds itself to the signature chain)
        phoneTeam.join(proofOfInvitation)

        // ✅ Now Alice has 💻📱 two devices on the signature chain
        expect(phoneTeam.members('alice').devices).toHaveLength(2)
      })
    })
  })
})
