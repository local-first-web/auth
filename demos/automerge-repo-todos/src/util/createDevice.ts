import * as Auth from '@localfirst/auth'
import { getDeviceNameFromUa } from './getDeviceNameFromUa'

export const createDevice = (userId: string) => {
  const deviceName = getDeviceNameFromUa()
  const device = Auth.createDevice(userId, deviceName)
  return device
}
