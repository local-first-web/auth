import { load } from '@/team/index.js'
import { setup } from '@/util/testing/index.js'

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
      const { alice } = setup('alice', 'bob')

      // We start with generation 0 keys
      expect(alice.team.teamKeys().generation).toBe(0)

      // Alice removes Bob, triggering a key rotation
      alice.team.remove('bob')
      expect(alice.team.teamKeys().generation).toBe(1)

      // Alice does some other stuff — say she adds a role
      alice.team.addRole('managers')

      // We now have generation 1 keys
      expect(alice.team.teamKeys().generation).toBe(1)

      // Alice saves the team
      const savedChain = alice.team.save()

      // Even though the team is saved with multiple generations of keys,
      // we can still decrypt it starting with only the original keys
      const originalTeamKeys = alice.team.teamKeys(0)
      const restoredTeam = load(savedChain, alice.localContext, originalTeamKeys)
      expect(restoredTeam.hasRole('managers')).toBe(true)
    })
  })
})
