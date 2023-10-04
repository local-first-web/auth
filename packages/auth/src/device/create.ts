import { randomKey } from '@herbcaudill/crypto'
import { createKeyset, KeyType } from 'crdx'
import { getDeviceId } from './getDeviceId.js'
import { DeviceWithSecrets } from './types.js'

export const createDevice = (
  userName: string,
  deviceName: string,
  seed: string = randomKey()
): DeviceWithSecrets => {
  const deviceId = getDeviceId({ userId: userName, deviceName })
  const keys = createKeyset({ type: KeyType.DEVICE, name: deviceId }, seed)
  return { userId: userName, deviceName, keys }
}
