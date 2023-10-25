import { createKeyset } from '@localfirst/crdx'
import { randomKey } from '@localfirst/crypto'
import { getDeviceId } from './getDeviceId.js'
import { type DeviceWithSecrets } from './types.js'
import { KeyType } from '@/util/index.js'

export const createDevice = (
  userName: string,
  deviceName: string,
  seed: string = randomKey()
): DeviceWithSecrets => {
  const deviceId = getDeviceId({ userId: userName, deviceName })
  const keys = createKeyset({ type: KeyType.DEVICE, name: deviceId }, seed)
  return { userId: userName, deviceName, keys }
}
