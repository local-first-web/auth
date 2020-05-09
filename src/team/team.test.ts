import { ContextWithSecrets, DeviceType } from '../context'
import { deriveKeys, randomKey } from '../keys'
import { UserWithSecrets } from '../user'
import { Team } from './team'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const setup = () => {
    const alice: UserWithSecrets = {
      name: 'alice',
      keys: deriveKeys(randomKey()),
    }
    const eve: UserWithSecrets = {
      name: 'eve',
      keys: deriveKeys(randomKey()),
    }

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
      expect(team.name).toBe('Spies Я Us')
    })

    it('saves & loads', () => {
      const { team, context } = setup()
      const savedChain = team.save()
      const restoredTeam = new Team({ source: JSON.parse(savedChain), context })
      expect(restoredTeam.name).toBe('Spies Я Us')
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
      expect(alice.name).toBe('alice')
    })

    it('throws when asked for a nonexistent member', () => {
      const { team } = setup()
      const findNonexistent = () => team.members('ned')
      expect(findNonexistent).toThrow('Member ned was not found')
    })
  })
})
