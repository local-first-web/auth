import { User } from '/user/types'
import * as keyset from '/keyset'
import { saveUser } from '/storage'
import { DeviceInfo, getDeviceId, DeviceType } from '/device'
import { randomKey } from '@herbcaudill/crypto'

const { DEVICE, MEMBER } = keyset.KeyType

/**
 * Creates a new local user, with randomly-generated keys.
 *
 * @param params.userName The local user's user name.
 * @param params.deviceName The local user's device.
 * @param params.deviceType The local user's device type.
 * @param params.seed (optional) A seed for generating keys. This is typically only used for
 * testing purposes, to ensure predictable data.
 */
export const create = (params: {
  userName: string
  deviceName: string
  deviceType: DeviceType
  seed?: string
}) => {
  const {
    userName, //
    deviceName,
    deviceType,
    seed = randomKey(),
  } = params

  const device = { userName, deviceName, type: deviceType } as DeviceInfo
  const deviceId = getDeviceId(device)

  const user: User = {
    userName,
    keys: keyset.create({ type: MEMBER, name: userName }, seed),
    device: {
      ...device,
      keys: keyset.create({ type: DEVICE, name: deviceId }, seed),
    },
  }

  // persist the user (including user keys & device keys) to device
  saveUser(user) // Q: should this be our job?

  return user
}
