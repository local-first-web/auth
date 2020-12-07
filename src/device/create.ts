import { getDeviceId } from '/device/getDeviceId'
import { DeviceInfo, DeviceWithSecrets } from '/device/types'
import * as keyset from '/keyset'
export function create(deviceInfo: DeviceInfo): DeviceWithSecrets {
  const deviceId = getDeviceId(deviceInfo)
  const keys = keyset.create({ type: keyset.KeyType.DEVICE, name: deviceId })
  return { ...deviceInfo, keys }
}
