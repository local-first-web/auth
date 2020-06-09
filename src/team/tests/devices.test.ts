import { Team } from '/team'
import { defaultContext, storage, newTeamChain } from '/team/tests/utils'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  const setup = () => {
    const context = defaultContext
    const team = new Team({ source: newTeamChain, context })
    return { team, context }
  }

  describe('devices', () => {
    it.todo('adds a device')
    it.todo('removes a device')
    it.todo('rotates keys after removing a device')
  })
})
