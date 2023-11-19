import { createUser } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { createTeam } from '../createTeam.js'
import { createDevice } from 'device/index.js'

describe('Team', () => {
  describe('create', () => {
    it('returns a new team', () => {
      const user = createUser('alice', 'Alice McUser')
      const device = createDevice('alice', 'laptop')
      const team = createTeam('Spies Я Us', { user, device })
      expect(team.teamName).toBe('Spies Я Us')
    })
  })
})
