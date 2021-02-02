import { hash, base64, Base64 } from '@herbcaudill/crypto'
import { DeviceInfo } from '/device/types'
import { HashPurpose } from '/util'

/** The deviceId is a hash of the device name and username; we use it to identify the device
 *  uniquely in public situations where we want to avoid leaking more info than necessary
 */
export const getDeviceId = ({ deviceName, userName }: Omit<DeviceInfo, 'type'>): Base64 => {
  const isTestEnvironment = process.env.NODE_ENV === 'test'

  return isTestEnvironment
    ? `deviceId::${userName}::${deviceName}` // keep it human-readable when testing
    : base64.encode(hash(HashPurpose.DEVICE_ID, { deviceName, userName }))
}
