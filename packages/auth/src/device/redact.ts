import { redactKeys } from '@localfirst/crdx'
import { type DeviceWithSecrets, type Device } from 'device/types.js'

export const redactDevice = (device: DeviceWithSecrets): Device => ({
  userId: device.userId,
  deviceId: device.deviceId,
  deviceName: device.deviceName,
  deviceInfo: device.deviceInfo,
  keys: redactKeys(device.keys),
})
