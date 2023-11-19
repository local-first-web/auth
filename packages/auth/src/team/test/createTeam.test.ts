import { createUser } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { createTeam } from '../createTeam.js'
import { createDevice } from 'device/index.js'
import { setup } from 'util/testing/index.js'
import { load } from '../load.js'

describe('Team', () => {
  describe('createTeam', () => {
    it('returns a new team', () => {
      const user = createUser('alice', 'Alice McUser')
      const device = createDevice('alice', 'laptop')
      const team = createTeam('Spies Я Us', { user, device })
      expect(team.teamName).toBe('Spies Я Us')
    })

    it('saves & loads', () => {
      const { alice } = setup('alice')
      const savedChain = alice.team.save()
      const savedKeys = alice.team.teamKeyring()

      const restoredTeam = load(savedChain, alice.localContext, savedKeys)
      expect(restoredTeam.teamName).toBe('Spies Я Us')
    })

    it('deserializes a team after key rotations', () => {
      const { alice, bob } = setup('alice', 'bob')

      // We start with generation 0 keys
      expect(alice.team.teamKeys().generation).toBe(0)

      // Alice removes Bob, triggering a key rotation
      alice.team.remove(bob.userId)
      expect(alice.team.teamKeys().generation).toBe(1)

      // Alice does some other stuff — say she adds a role
      alice.team.addRole('managers')

      // Alice saves the team
      const savedChain = alice.team.save()
      const savedKeys = alice.team.teamKeyring()

      const restoredTeam = load(savedChain, alice.localContext, savedKeys)

      expect(restoredTeam.hasRole('managers')).toBe(true)
    })
  })
})
