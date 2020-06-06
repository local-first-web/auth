import { bob, eve, defaultContext, storage, teamChain, charlie, bobsContext } from './utils'
import { accept, ProofOfInvitation } from '/invitation'
import { Team } from '/team'
import { redactUser } from '/user'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  const setup = () => {
    const context = defaultContext
    const team = new Team({ source: teamChain, context })
    return { team, context }
  }

  describe('invitations', () => {
    it('creates an invitation', () => {
      const { team } = setup()

      // Alice invites Bob
      const secretKey = team.invite('bob')
      expect(secretKey).toHaveLength(16)
    })

    it('accepts valid proof of invitation', () => {
      const { team: alicesTeam } = setup()

      // Alice invites Bob by sending him a secret key
      const secretKey = alicesTeam.invite('bob')

      // Bob accepts the invitation
      const proofOfInvitation = accept(secretKey, redactUser(bob))

      // Bob shows Alice his proof of invitation, and she lets him in
      alicesTeam.admit(proofOfInvitation)

      // Bob is now on the team. Congratulations, Bob!
      expect(alicesTeam.has('bob')).toBe(true)
    })

    it('rejects forged proof of invitation', () => {
      const { team: alicesTeam } = setup()

      // Alice invites Bob
      const secretKey = alicesTeam.invite('bob')

      // Bob accepts the invitation
      const proofOfInvitation = accept(secretKey, redactUser(bob))

      // Eve intercepts the invitation and tries to use it by swapping out bob's info for hers
      const forgedProofOfInvitation: ProofOfInvitation = {
        ...proofOfInvitation,
        member: redactUser(eve),
      }

      // Eve shows Alice her fake proof of invitation
      const presentForgedInvitation = () => alicesTeam.admit(forgedProofOfInvitation)

      // but Alice is not fooled
      expect(presentForgedInvitation).toThrow()
    })

    it('allows non-admins to accept an invitation', () => {
      const { team: alicesTeam } = setup()
      alicesTeam.add(redactUser(bob)) // bob is not an admin

      // Alice invites Charlie by sending him a secret key
      const secretKey = alicesTeam.invite('charlie')
      storage.save(alicesTeam)

      // Charlie accepts the invitation
      const proofOfInvitation = accept(secretKey, redactUser(charlie))

      // Bob loads the team from storage
      const bobsTeam = storage.load(bobsContext)

      // Bob still isn't an admin
      expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

      // Charlie shows Bob his proof of invitation
      bobsTeam.admit(proofOfInvitation)

      // Charlie is now on the team. Congratulations, Bob!
      expect(alicesTeam.has('bob')).toBe(true)
    })
  })
})
