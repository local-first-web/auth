import { randomKey } from '@herbcaudill/crypto'
import { createKeyset, KeyType } from 'crdx'
import { getDeviceId } from './getDeviceId'
import { DeviceWithSecrets } from './types'

export const createDevice = (
  userName: string,
  deviceName: string,
  seed: string = randomKey()
): DeviceWithSecrets => {
  const deviceId = getDeviceId({ userName, deviceName })
  const keys = createKeyset({ type: KeyType.DEVICE, name: deviceId }, seed)
  return { userName, deviceName, keys }
}
