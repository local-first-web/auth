import { DeviceInfo } from '@/device/types'

const separator = '::'

/** Unique identifier for a device = deviceName + userName */
export const getDeviceId = ({ deviceName, userName }: DeviceInfo): string =>
  `${userName}${separator}${deviceName}`

export const parseDeviceId = (deviceId: string): DeviceInfo => {
  const [userName, deviceName] = deviceId.split(separator)
  return { userName, deviceName }
}
