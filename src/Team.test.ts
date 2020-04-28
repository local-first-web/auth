import { Team } from './Team'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns a new team', () => {
    const team = new Team({ name: 'Spies Я Us', user: 'herb' })
    expect(team.name).toBe('Spies Я Us')
    expect(team.user.name).toBe('herb')
  })

  it('returns a new team', () => {
    const team = new Team({ name: 'Spies Я Us', user: 'herb' })
    expect(team.name).toBe('Spies Я Us')
    expect(team.user.name).toBe('herb')
  })

  it('adds a root block to the signature chain', () => {
    const team = new Team({ name: 'Spies Я Us', user: 'herb' })
    expect(team.signatureChain).toHaveLength(1)
  })
})
