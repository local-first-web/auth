import { ContextWithSecrets, DeviceType } from '../context'
import { deriveKeys, randomKey, redactKeys } from '../keys'
import { User, UserWithSecrets } from '../user'
import { Team } from './team'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const alice: UserWithSecrets = {
    userName: 'alice',
    keys: deriveKeys(randomKey()),
  }
  const bob: User = {
    userName: 'bob',
    keys: redactKeys(deriveKeys(randomKey())),
  }

  const setup = () => {
    const context: ContextWithSecrets = {
      user: alice,
      device: {
        name: 'windows laptop',
        type: DeviceType.laptop,
      },
      client: {
        name: 'test',
        version: '0',
      },
    }

    const team = new Team({ teamName: 'Spies Я Us', context })
    return { team, context }
  }

  describe('create', () => {
    it('returns a new team', () => {
      const { team } = setup()
      expect(team.teamName).toBe('Spies Я Us')
    })

    it('saves & loads', () => {
      const { team, context } = setup()
      const savedChain = team.save()
      const restoredTeam = new Team({ source: JSON.parse(savedChain), context })
      expect(restoredTeam.teamName).toBe('Spies Я Us')
    })

    it('throws if saved chain is tampered with', () => {
      const { team, context } = setup()
      const savedChain = team.save()
      const tamperedChain = savedChain.replace(/alice/gi, 'eve')
      const restoreTampered = () =>
        new Team({ source: JSON.parse(tamperedChain), context })
      expect(restoreTampered).toThrow('Signature is not valid')
    })
  })

  describe('members', () => {
    it('has a root member', () => {
      const { team } = setup()
      expect(team.members().length).toBe(1)
      const alice = team.members('alice')
      expect(alice.userName).toBe('alice')
    })

    it('throws when asked for a nonexistent member', () => {
      const { team } = setup()
      const findNonexistent = () => team.members('ned')
      expect(findNonexistent).toThrow('Member ned was not found')
    })

    it('adds a member', () => {
      const { team } = setup()
      team.add(bob)
      expect(team.members().length).toBe(2)
      expect(team.members('bob').userName).toBe('bob')
    })

    it('removes a member', () => {
      const { team } = setup()

      team.add(bob)
      expect(team.has('bob')).toBe(true)

      team.remove('bob')
      expect(team.has('bob')).toBe(false)
    })

    it.todo('rotates keys after removing a member')
    it.todo('adds a device')
    it.todo('removes a device')
    it.todo('rotates keys after removing a device')
  })

  describe('invitations', () => {
    it.todo('generates an invitation')
    it.todo('accepts valid proof of invitation')
    it.todo('rejects invalid proof of invitation')
    it.todo('only allows an invitation to be used once ')
    it.todo('does not allow another admin to hijack an invitation')
  })

  describe('roles', () => {
    it('alice is admin', () => {
      const { team } = setup()
      const _alice = team.members('alice')
      expect(_alice.hasRole('admin')).toBe(true)
    })

    it('bob is not admin', () => {
      const { team } = setup()
      team.add(bob)
      const _bob = team.members('bob')
      expect(_bob.hasRole('admin')).toBe(false)
    })

    it('does not allow a non-admin to add a member', () => {})

    it.todo('does not allow a non-admin to remove a member')

    it.todo('adds a role')
    it.todo('adds a member to a role')
    it.todo('removes a member from a role')
    it.todo('rotates keys after removing a member from a role')
  })

  describe('crypto', () => {
    it.todo('encrypts content for the team')
    it.todo('encrypts content a specific member')
  })
})
