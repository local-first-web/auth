import { DeviceWithSecrets, PublicDevice } from '@/device/types'
import { redactKeys } from 'crdx'

export const redactDevice = (device: DeviceWithSecrets): PublicDevice => ({
  userName: device.userName,
  deviceName: device.deviceName,
  keys: redactKeys(device.keys),
})
