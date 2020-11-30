import { load } from '/team/load'
import { generateProof, ProofOfInvitation } from '/invitation'
import { ADMIN } from '/role'
import { alicesContext, bob, bobsContext, defaultContext, newTeam } from '/util/testing'

describe('Team', () => {
  const setup = () => ({
    team: newTeam(),
    context: defaultContext,
  })

  describe('invitations', () => {
    describe('members', () => {
      it('accepts valid proof of invitation', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨‍🦲 Bob by sending him a random secret key
        const { seed } = alicesTeam.invite('bob')

        // 👨‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, 'bob')

        // 👨‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in
        alicesTeam.admit(proofOfInvitation)

        // ✅ 👨‍🦲 Bob is now on the team. Congratulations, Bob!
        expect(alicesTeam.has('bob')).toBe(true)
      })

      it('lets you use a key of your choosing', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨‍🦲 Bob by sending him a secret key of her choosing
        const seed = 'passw0rd'
        alicesTeam.invite('bob', { seed })

        const proofOfInvitation = generateProof(seed, 'bob')
        alicesTeam.admit(proofOfInvitation)

        // ✅ Still works
        expect(alicesTeam.has('bob')).toBe(true)
      })

      it('normalizes the secret key', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨‍🦲 Bob
        const seed = 'abc def ghi'
        alicesTeam.invite('bob', { seed })

        // 👨‍🦲 Bob accepts the invitation using a url-friendlier version of the key
        const proofOfInvitation = generateProof('abc+def+ghi', 'bob')
        alicesTeam.admit(proofOfInvitation)

        // ✅ Bob is on the team
        expect(alicesTeam.has('bob')).toBe(true)
      })

      it('supports including roles in the invitation', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨‍🦲 Bob as admin
        const { seed } = alicesTeam.invite('bob', { roles: [ADMIN] })

        // 👨‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, 'bob')
        alicesTeam.admit(proofOfInvitation)

        // ✅ Bob is on the team as an admin
        expect(alicesTeam.memberIsAdmin('bob')).toBe(true)
      })

      it('rejects invitation if name is altered', () => {
        const { team: alicesTeam } = setup()

        // 👩🏾 Alice invites 👨‍🦲 Bob
        const { seed } = alicesTeam.invite('bob')

        // 👨‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, 'bob')

        // 🦹‍♀️ Eve intercepts the invitation and tries to use it by swapping out Bob's name for hers
        const forgedProofOfInvitation: ProofOfInvitation = { ...proofOfInvitation, userName: 'eve' }

        // 🦹‍♀️ Eve shows 👩🏾 Alice her fake proof of invitation
        const presentForgedInvitation = () => alicesTeam.admit(forgedProofOfInvitation)

        // ❌ but 👩🏾 Alice is not fooled
        expect(presentForgedInvitation).toThrow(/User names don't match/)
      })

      it('allows non-admins to accept an invitation', () => {
        let { team: alicesTeam } = setup()
        alicesTeam.add(bob) // bob is not an admin

        // 👩🏾 Alice invites 👳‍♂️ Charlie by sending him a secret key
        const { seed } = alicesTeam.invite('charlie')

        // 👳‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed, 'charlie')

        // later, 👩🏾 Alice is no longer around, but 👨‍🦲 Bob is online
        let persistedTeam = alicesTeam.save()
        const bobsTeam = load(persistedTeam, bobsContext)

        // just to confirm: 👨‍🦲 Bob isn't an admin
        expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

        // 👳‍♂️ Charlie shows 👨‍🦲 Bob his proof of invitation
        bobsTeam.admit(proofOfInvitation)

        // 👳‍♂️ Charlie is now on the team
        expect(bobsTeam.has('charlie')).toBe(true)

        // ✅ 👩🏾 Alice can now see that 👳‍♂️ Charlie is on the team. Congratulations, Charlie!
        persistedTeam = bobsTeam.save()
        alicesTeam = load(persistedTeam, alicesContext)
        expect(alicesTeam.has('charlie')).toBe(true)
      })

      it('allows revoking an invitation', () => {
        let { team: alicesTeam } = setup()
        alicesTeam.add(bob)

        // 👩🏾 Alice invites 👳‍♂️ Charlie by sending him a secret key
        const { seed, id } = alicesTeam.invite('charlie')

        // 👳‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed, 'charlie')

        // 👩🏾 Alice changes her mind and revokes the invitation
        alicesTeam.revokeInvitation(id)
        alicesTeam.remove('charlie') // we now have to do this explicitly

        // TODO: should revoking implicitly remove the member? See Team.ts:revokeInvitation

        // later, 👩🏾 Alice is no longer around, but 👨‍🦲 Bob is online
        const persistedTeam = alicesTeam.save()
        const bobsTeam = load(persistedTeam, bobsContext)

        // 👳‍♂️ Charlie shows 👨‍🦲 Bob his proof of invitation
        const tryToAdmitCharlie = () => bobsTeam.admit(proofOfInvitation)

        // ❌ But the invitation is rejected
        expect(tryToAdmitCharlie).toThrowError(/revoked/)

        // 👳‍♂️ Charlie is not on the team
        expect(bobsTeam.has('charlie')).toBe(false)
      })
    })

    describe('devices', () => {
      it('creates and accepts an invitation for a device', () => {
        const { team } = setup()

        // 💻 on her laptop, Alice generates an invitation for herself (so a device invitation)
        const { seed } = team.invite('alice')

        // 📱 Alice gets the secret invitation key to her phone, perhaps by typing it in or by
        // scanning a QR code. Alice's phone uses the secret key to generate proof of invitation
        const proofOfInvitation = generateProof(seed, 'alice')

        // 📱 Alice's phone connects with 💻 her laptop and presents the proof
        team.admit(proofOfInvitation)
      })
    })
  })
})
