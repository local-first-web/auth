import { alice, defaultContext, newTeam, storage } from '/util/testing'

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
    it('adds a device', () => {
      const { team } = setup()
      // team.addDevice(alice.userName, laptop)
    })

    it('removes a device', () => {})

    it('rotates keys after removing a device', () => {})
  })
})
