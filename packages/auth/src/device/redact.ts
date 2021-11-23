import { DeviceWithSecrets, Device } from '@/device/types'
import { redactKeys } from 'crdx'

export const redactDevice = (device: DeviceWithSecrets): Device => ({
  userName: device.userName,
  deviceName: device.deviceName,
  keys: redactKeys(device.keys),
})
