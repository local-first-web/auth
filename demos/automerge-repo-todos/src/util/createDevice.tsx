import * as Auth from "@localfirst/auth"
import { getDeviceNameFromUa } from "./getDeviceNameFromUa"

export const createDevice = (user: Auth.User) => {
  const deviceName = getDeviceNameFromUa()
  const device = Auth.createDevice(user.userId, deviceName)
  return device
}
