import { ContextWithSecrets, DeviceType } from '../context'
import { deriveKeys, randomKey } from '../keys'
import { UserWithSecrets } from '../user'
import { Team } from './team'

describe('Team', () => {
  const alice: UserWithSecrets = {
    name: 'alice',
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
    const team = new Team({ name: 'Spies Я Us', context })
    return { team }
  }

  it('returns a new team', () => {
    const { team } = setup()
    expect(team.name).toBe('Spies Я Us')
  })

  // NEXT: ADD A MEMBER
})
