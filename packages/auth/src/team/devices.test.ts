import { describe, expect, it } from 'vitest'
import { setup as setupUsers } from '@/util/testing/index.js'

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

    it("Alice can remove Bob's device", () => {
      const { alice } = setup()
      alice.team.removeDevice('bob', 'laptop')
      expect(alice.team.members('bob').devices).toHaveLength(0)

      // DeviceWasRemoved works as expected
      expect(alice.team.deviceWasRemoved('alice', 'laptop')).toBe(false) // Device still exists
      expect(alice.team.deviceWasRemoved('bob', 'laptop')).toBe(true) // Device was removed
      expect(alice.team.deviceWasRemoved('bob', 'phone')).toBe(false) // Device never existed
    })

    it('throws when trying to access a removed device', () => {
      const { alice } = setup()
      const bobDevice = alice.team.members('bob').devices[0].deviceName
      alice.team.removeDevice('bob', bobDevice)

      const getDevice = () => alice.team.device('bob', bobDevice)
      expect(getDevice).toThrow()
    })

    it("doesn't throw when deliberately trying to access a removed device", () => {
      const { alice } = setup()
      const bobDevice = alice.team.members('bob').devices[0].deviceName
      alice.team.removeDevice('bob', bobDevice)

      const getDevice = () => alice.team.device('bob', bobDevice, { includeRemoved: true })
      expect(getDevice).not.toThrow()
    })

    it("Bob cannot remove Alice's device", () => {
      const { bob } = setup()
      const aliceDevice = bob.team.members('alice').devices[0].deviceName
      const tryToRemoveDevice = () => {
        bob.team.removeDevice('alice', aliceDevice)
      }

      expect(tryToRemoveDevice).toThrowError()
    })

    it('can look up a device by name', () => {
      const { alice } = setup()
      const { deviceName } = alice.device
      const aliceDevice = alice.team.device('alice', deviceName)
      expect(aliceDevice).not.toBeUndefined()
      expect(aliceDevice.deviceName).toBe(deviceName)
    })

    it('throws when trying to access a nonexistent device', () => {
      const { alice } = setup()
      const getDevice = () => alice.team.device('alice', 'alicez wrist communicator')
      expect(getDevice).toThrow()
    })

    it('rotates keys after removing a device', () => {
      const { alice } = setup()

      // Keys have never been rotated
      expect(alice.team.teamKeys().generation).toBe(0)
      const { secretKey } = alice.team.teamKeys()

      // Remove bob's device
      const bobDevice = alice.team.members('bob').devices[0].deviceName
      alice.team.removeDevice('bob', bobDevice)

      // Team keys have now been rotated once
      expect(alice.team.teamKeys().generation).toBe(1)
      expect(alice.team.teamKeys().secretKey).not.toBe(secretKey)
    })
  })
})
