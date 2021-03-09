import { randomKey } from '@herbcaudill/crypto'
import { getDeviceId } from '@/device/getDeviceId'
import { DeviceWithSecrets } from '@/device/types'
import * as keyset from '@/keyset'

export const create = (
  userName: string,
  deviceName: string,
  seed: string = randomKey()
): DeviceWithSecrets => {
  const deviceId = getDeviceId({ userName, deviceName })
  const keys = keyset.create({ type: keyset.KeyType.DEVICE, name: deviceId }, seed)
  return { userName, deviceName, keys }
}
