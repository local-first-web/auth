import { DeviceInfo } from '@/device/types'

const separator = '::'

/** Unique identifier for a device = deviceName + userName */
export const getDeviceId = ({ deviceName, userId }: DeviceInfo): string =>
  `${userId}${separator}${deviceName}`

export const parseDeviceId = (deviceId: string): DeviceInfo => {
  const [userId, deviceName] = deviceId.split(separator)
  return { userId: userId, deviceName }
}
