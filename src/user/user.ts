import { User } from '/user/types'
import { Device } from '/context'
import * as keyset from '/keyset'
import { loadUser, saveUser } from '/storage'

const { DEVICE, MEMBER } = keyset.KeyType

export const create = (userName: string, device: Device) => {
  const deviceKeys = keyset.create({ type: DEVICE, name: device.name })
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
