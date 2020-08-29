import { User } from '/user/types'
import * as keyset from '/keyset'
import { saveUser } from '/storage'
import { DeviceInfo, getDeviceId, DeviceType } from '/device'

const { DEVICE, MEMBER } = keyset.KeyType

export const create = (
  userName: string,
  deviceName: string = `${userName}'s device`,
  deviceType = DeviceType.other
) => {
  const device: DeviceInfo = { userName, name: deviceName, type: deviceType }
  const deviceId = getDeviceId(device)

  // generate new random keys for the user and the device
  const deviceKeys = keyset.create({ type: DEVICE, name: deviceId })
  const userKeys = keyset.create({ type: MEMBER, name: userName })

  const user: User = {
    userName,
    keys: userKeys,
    device: {
      ...device,
      keys: deviceKeys,
    },
  }

  // persist the user (including user keys & device keys) to device
  saveUser(user)

  return user
}
