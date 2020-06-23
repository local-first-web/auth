import { User } from '/user/types'
import * as keyset from '/keyset'
import { loadUser, saveUser } from '/storage'
import { DeviceInfo, getDeviceId } from '/device'

const { DEVICE, MEMBER } = keyset.KeyType

export const create = (userName: string, device: DeviceInfo) => {
  const deviceId = getDeviceId(device)
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
  saveUser(user)
  return user
}

export const load = () => loadUser()
