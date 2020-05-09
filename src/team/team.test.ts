import { ContextWithSecrets, DeviceType } from '../context'
import { deriveKeys, randomKey } from '../keys'
import { UserWithSecrets } from '../user'
import { Team } from './team'

describe('Team', () => {
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

  beforeEach(() => {
    localStorage.clear()
  })

  const setup = () => {
    const team = new Team({ teamName: 'Spies Я Us', context })
    return { team }
  }

  describe('create', () => {
    it('returns a new team', () => {
      const { team } = setup()
      expect(team.name).toBe('Spies Я Us')
    })

    it('saves & loads', () => {
      const { team } = setup()
      const savedTeam = team.save()
      const restoredTeam = new Team({ source: JSON.parse(savedTeam), context })
      expect(restoredTeam.name).toBe('Spies Я Us')
    })
  })

  describe('members', () => {
    it('has a root member', () => {
      const { team } = setup()
      expect(team.members().length).toBe(1)
      const alice = team.members('alice')
      expect(alice.name).toBe('alice')
    })
  })
})
