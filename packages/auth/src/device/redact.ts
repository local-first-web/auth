import { DeviceWithSecrets, Device } from '@/device/types.js'
import { redactKeys } from 'crdx'

export const redactDevice = (device: DeviceWithSecrets): Device => ({
  userId: device.userId,
  deviceName: device.deviceName,
  keys: redactKeys(device.keys),
})
