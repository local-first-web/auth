import { randomKey } from '@herbcaudill/crypto'
import { getDeviceId } from '/device/getDeviceId'
import { DeviceInfo, DeviceWithSecrets } from '/device/types'
import * as keyset from '/keyset'

export const create = (deviceInfo: DeviceInfo, seed: string = randomKey()): DeviceWithSecrets => {
  const deviceId = getDeviceId(deviceInfo)
  const keys = keyset.create({ type: keyset.KeyType.DEVICE, name: deviceId }, seed)
  return { ...deviceInfo, keys }
}
