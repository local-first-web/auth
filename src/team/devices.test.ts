import { KeyType } from '/keyset'

const { DEVICE } = KeyType

describe('Team', () => {
  // TODO
  describe('devices', () => {
    it('removes a device', () => {
      // const { team, context } = setup()
      // // From her laptop, Alice adds her phone
      // expect(context.user.device.name).toBe(`alice's device`)
      // const device = { userName: 'alice', name: `alice's phone` }
      // const { secretKey } = team.inviteDevice(device)
      // const deviceId = getDeviceId(device)
      // const deviceKeys = keyset.create({ type: DEVICE, name: deviceId })
      // const deviceWithSecrets: DeviceWithSecrets = { ...device, keys: deviceKeys }
      // const proofOfInvitation = acceptDeviceInvitation(secretKey, redactDevice(deviceWithSecrets))
      // team.admitDevice(proofOfInvitation)
      // // Alice's phone is now listed on the signature chain
      // expect(team.members('alice').devices!.map(d => d.deviceId)).toContain(deviceId)
      // team.removeDevice(device)
      // // Alice's phone is no longer listed
      // expect(team.members('alice').devices!.map(d => d.deviceId)).not.toContain(deviceId)
    })

    it('rotates keys after removing a device', () => {})
  })
})
