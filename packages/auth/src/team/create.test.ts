import { load } from '@/team'
import { setup } from '@/util/testing'

describe('Team', () => {
  describe('create', () => {
    it('returns a new team', () => {
      const { alice } = setup('alice')
      expect(alice.team.teamName).toBe('Spies Я Us')
    })

    it('saves & loads', () => {
      const { alice } = setup('alice')
      const savedChain = alice.team.save()
      const restoredTeam = load(savedChain, alice.localContext, alice.team.teamKeys())
      expect(restoredTeam.teamName).toBe('Spies Я Us')
    })

    it('deserializes a team after key rotations', () => {
      const { alice, bob } = setup('alice', 'bob')

      expect(alice.team.teamKeys().generation).toBe(0)

      // Alice removes Bob, triggering a key rotation
      alice.team.remove('bob')
      expect(alice.team.teamKeys().generation).toBe(1)

      // Alice does some other stuff — say she adds a role
      alice.team.addRole('managers')

      // Alice saves the team
      const savedChain = alice.team.save()
      const restoredTeam = load(savedChain, alice.localContext, alice.team.teamKeys())
      expect(restoredTeam.hasRole('managers')).toBe(true)
    })
  })
})
