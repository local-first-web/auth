import { defaultContext, storage, teamChain } from './utils'
import { Team } from '/team'

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

  describe('crypto', () => {
    it.todo('encrypts content for the team')
    it.todo('encrypts content for a role')
    it.todo('encrypts content for a specific member')
    it.todo(`after charlie is removed, he can't read encrypted team content`)
  })
})
