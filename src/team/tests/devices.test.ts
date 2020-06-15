import { defaultContext, newTeam, storage } from '/util/testing'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  const setup = () => ({
    team: newTeam(),
    context: defaultContext,
  })

  describe('devices', () => {
    it.todo('adds a device')
    it.todo('removes a device')
    it.todo('rotates keys after removing a device')
  })
})
