import { DeviceInfo } from '@/device/types'

const separator = '::'

/** Unique identifier for a device = deviceName + userName */
export const getDeviceId = ({ deviceName, userId }: DeviceInfo): string => {
  if (deviceName === userId) return deviceName
  else return `${userId}${separator}${deviceName}`
}

export const parseDeviceId = (deviceId: string): DeviceInfo => {
  if (deviceId.includes(separator)) {
    const [userId, deviceName] = deviceId.split(separator)
    return { userId: userId, deviceName }
  } else {
    return { userId: deviceId, deviceName: deviceId }
  }
}
