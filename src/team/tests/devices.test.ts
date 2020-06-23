import { DeviceType } from '/device'
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
    it('adds a device', () => {
      const { team, context } = setup()

      // Alice is on her laptop
      expect(context.user.device.name).toBe(`alice's laptop`)

      // Alice decides to add a phone
      const secretKey = team.inviteDevice({
        userName: 'alice',
        name: 'iPhone 11',
        type: DeviceType.mobile,
      })
    })

    it('removes a device', () => {})

    it('rotates keys after removing a device', () => {})
  })
})
