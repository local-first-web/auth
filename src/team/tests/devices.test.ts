import { redact as redactDevice, DeviceType, DeviceWithSecrets, getDeviceId } from '/device'
import { KeyType } from '/keyset'
import { defaultContext, newTeam } from '/util/testing'
import { storage } from '/util/testing'
import * as keyset from '/keyset'
import { acceptDeviceInvitation, newInvitationKey } from '/invitation'

const { DEVICE } = KeyType

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
    it('removes a device', () => {})

    it('rotates keys after removing a device', () => {})
  })
})
