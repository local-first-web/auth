import { getDeviceId } from '/device/getDeviceId'
import { DeviceWithSecrets, PublicDevice } from '/device/types'
import * as keyset from '/keyset'

export const redactDevice = (device: DeviceWithSecrets): PublicDevice => ({
  userName: device.userName,
  deviceId: getDeviceId(device),
  keys: keyset.redactKeys(device.keys),
})
