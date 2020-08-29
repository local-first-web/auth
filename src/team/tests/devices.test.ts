import { DeviceType } from '/device'
import { defaultContext, newTeam } from '/util/testing'
import { storage } from '/util/testing'

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
      expect(context.user.device.name).toBe(`alice's device`)

      // Alice authorizes her phone from her laptop
      const secretKey = team.inviteDevice({
        userName: 'alice',
        name: 'iPhone 11',
        type: DeviceType.mobile,
      })

      // Alice sends the secret invitation key to the phone via a secure channel (e.g. by showing the phone a QR code)
      // Alice's phone uses the secret key to generate proof of invitation

      // Alice's phone connects with her laptop and presents the proof

      // Alice's laptop adds the phone
    })

    it('removes a device', () => {})

    it('rotates keys after removing a device', () => {})
  })
})
