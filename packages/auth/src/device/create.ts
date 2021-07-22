import { getDeviceId } from '@/device/getDeviceId'
import { DeviceWithSecrets } from '@/device/types'
import { randomKey } from '@herbcaudill/crypto'
import { createKeyset, KeyType } from 'crdx'

export const create = (
  userName: string,
  deviceName: string,
  seed: string = randomKey()
): DeviceWithSecrets => {
  const deviceId = getDeviceId({ userName, deviceName })
  const keys = createKeyset({ type: KeyType.DEVICE, name: deviceId }, seed)
  return { userName, deviceName, keys }
}
