import { getDeviceId } from '/device/getDeviceId'
import { DeviceWithSecrets, Device } from '/device/types'
import * as keyset from '/keyset'

export const redactDevice = (device: DeviceWithSecrets): Device => ({
  userName: device.userName,
  deviceId: getDeviceId(device),
  keys: keyset.redactKeys(device.keys),
})
