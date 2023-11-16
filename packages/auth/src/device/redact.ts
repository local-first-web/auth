import { redactKeys } from '@localfirst/crdx'
import { type DeviceWithSecrets, type Device } from 'device/types.js'

export const redactDevice = (device: DeviceWithSecrets): Device => ({
  userId: device.userId,
  deviceId: device.deviceId,
  deviceName: device.deviceName,
  keys: redactKeys(device.keys),
})
