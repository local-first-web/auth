import { acceptMemberInvitation, ProofOfInvitation } from '/invitation'
import { redact } from '/user'
import {
  alicesContext,
  bob,
  bobsContext,
  charlie,
  defaultContext,
  eve,
  newTeam,
  storage,
} from '/util/testing'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  const setup = () => ({
    team: newTeam(),
    context: defaultContext,
  })

  describe('invitations', () => {
    it('creates an invitation', () => {
      const { team } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey } = team.invite('bob')
      expect(secretKey).toHaveLength(16)
    })

    it('accepts valid proof of invitation', () => {
      const { team: alicesTeam } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob by sending him a secret key
      const { secretKey } = alicesTeam.invite('bob')

      // 👨‍🦲 Bob accepts the invitation
      const proofOfInvitation = acceptMemberInvitation(secretKey, bob)

      // 👨‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in
      alicesTeam.admit(proofOfInvitation)

      // ✅ 👨‍🦲 Bob is now on the team. Congratulations, Bob!
      expect(alicesTeam.has('bob')).toBe(true)
    })

    it('rejects forged proof of invitation', () => {
      const { team: alicesTeam } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey } = alicesTeam.invite('bob')

      // 👨‍🦲 Bob accepts the invitation
      const proofOfInvitation = acceptMemberInvitation(secretKey, bob)

      // 🦹‍♀️ Eve intercepts the invitation and tries to use it by swapping out Bob's info for hers
      const forgedProofOfInvitation: ProofOfInvitation = {
        ...proofOfInvitation,
        type: 'MEMBER',
        payload: redact(eve),
      }

      // 🦹‍♀️ Eve shows 👩🏾 Alice her fake proof of invitation
      const presentForgedInvitation = () => alicesTeam.admit(forgedProofOfInvitation)

      // ❌ but 👩🏾 Alice is not fooled
      expect(presentForgedInvitation).toThrow()
    })

    it('allows non-admins to accept an invitation', () => {
      let { team: alicesTeam } = setup()
      alicesTeam.add(bob) // bob is not an admin

      // 👩🏾 Alice invites 👳‍♂️ Charlie by sending him a secret key
      const { secretKey } = alicesTeam.invite('charlie')
      storage.save(alicesTeam)

      // 👳‍♂️ Charlie accepts the invitation
      const proofOfInvitation = acceptMemberInvitation(secretKey, charlie)

      // Alice is no longer around, but 👨‍🦲 Bob is online
      const bobsTeam = storage.load(bobsContext)

      // just to confirm: 👨‍🦲 Bob still isn't an admin
      expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

      // 👳‍♂️ Charlie shows 👨‍🦲 Bob his proof of invitation
      bobsTeam.admit(proofOfInvitation)

      // 👳‍♂️ Charlie is now on the team
      expect(bobsTeam.has('charlie')).toBe(true)

      // ✅ 👩🏾 Alice can now see that 👳‍♂️ Charlie is on the team. Congratulations, Charlie!
      storage.save(bobsTeam)
      alicesTeam = storage.load(alicesContext)
      expect(alicesTeam.has('charlie')).toBe(true)
    })
  })
})
