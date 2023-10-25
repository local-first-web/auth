import { type DeviceInfo } from '@/device/types.js'

const separator = '::'

/** Unique identifier for a device = deviceName + userName */
export const getDeviceId = ({ deviceName, userId }: DeviceInfo): string => {
  if (deviceName === userId) {
    return deviceName
  }

  return `${userId}${separator}${deviceName}`
}

export const parseDeviceId = (deviceId: string): DeviceInfo => {
  if (deviceId.includes(separator)) {
    const [userId, deviceName] = deviceId.split(separator)
    return { userId, deviceName }
  }

  return { userId: deviceId, deviceName: deviceId }
}
