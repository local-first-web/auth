// const separator = '::'

/** Unique identifier for a device = deviceName + userName */
export const getDeviceId = (_userId: string, _deviceName: string) => {
  throw new Error('getDeviceId is deprecated')
}

export const parseDeviceId = (_deviceId: string): { userId: string; deviceName: string } => {
  throw new Error('parseDeviceId is deprecated')
}
