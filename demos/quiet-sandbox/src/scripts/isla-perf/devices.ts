import { createHash } from "crypto"
import { DeviceService } from "../../auth/services/members/deviceService.js"

export const generateDeviceName = (username: string, index: number = 1): string => {
  return createHash('md5').update(`${username}-${DeviceService.determineDeviceName()}-${index}`).digest('hex')
}