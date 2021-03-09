import { DeviceWithSecrets, PublicDevice } from '@/device/types'
import * as keyset from '@/keyset'

export const redactDevice = (device: DeviceWithSecrets): PublicDevice => ({
  userName: device.userName,
  deviceName: device.deviceName,
  keys: keyset.redactKeys(device.keys),
})
