import { setup as setupUsers } from '@/util/testing'

describe('Team', () => {
  const setup = () => {
    const { alice, bob } = setupUsers(['alice', { user: 'bob', admin: false }])
    return { alice, bob }
  }

  describe('devices', () => {
    it('Alice has a device', () => {
      const { alice } = setup()
      expect(alice.team.members('alice').devices).toHaveLength(1)
    })

    it('Bob has a device', () => {
      const { alice } = setup()
      expect(alice.team.members('bob').devices).toHaveLength(1)
    })

    it(`Alice can remove Bob's device`, () => {
      const { alice } = setup()
      const bobDevice = alice.team.members('bob').devices![0].deviceName
      alice.team.removeDevice('bob', bobDevice)
      expect(alice.team.members('bob').devices).toHaveLength(0)
    })

    it(`throws when trying to access a removed device`, () => {
      const { alice } = setup()
      const bobDevice = alice.team.members('bob').devices![0].deviceName
      alice.team.removeDevice('bob', bobDevice)

      const getDevice = () => alice.team.device('bob', bobDevice)
      expect(getDevice).toThrow()
    })

    it(`Bob cannot remove Alice's device`, () => {
      const { bob } = setup()
      const aliceDevice = bob.team.members('alice').devices![0].deviceName
      const tryToRemoveDevice = () => bob.team.removeDevice('alice', aliceDevice)
      expect(tryToRemoveDevice).toThrowError()
    })

    it('can look up a device by name', () => {
      const { alice } = setup()
      const { deviceName } = alice.device
      const aliceDevice = alice.team.device('alice', deviceName)
      expect(aliceDevice).not.toBeUndefined()
      expect(aliceDevice.deviceName).toBe(deviceName)
    })

    it(`throws when trying to access a nonexistent device`, () => {
      const { alice } = setup()
      const getDevice = () => alice.team.device('alice', 'alicez wrist communicator')
      expect(getDevice).toThrow()
    })

    it('rotates keys after removing a device', () => {
      const { alice } = setup()

      // keys have never been rotated
      expect(alice.team.teamKeys().generation).toBe(0)
      const { secretKey } = alice.team.teamKeys()

      // remove bob's device
      const bobDevice = alice.team.members('bob').devices![0].deviceName
      alice.team.removeDevice('bob', bobDevice)

      // team keys have now been rotated once
      expect(alice.team.teamKeys().generation).toBe(1)
      expect(alice.team.teamKeys().secretKey).not.toBe(secretKey)
    })
  })
})
