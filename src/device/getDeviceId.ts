import { hash, base64, Base64 } from '@herbcaudill/crypto'
import { DeviceInfo } from '/device/types'
import { HashPurpose } from '/util'

/** The deviceId is a hash of the name and username; we use it to identify the device uniquely in
 *  public situations where we want to avoid leaking more info than necessary
 */
export const getDeviceId = ({ name, userName }: DeviceInfo): Base64 =>
  base64.encode(hash(HashPurpose.DEVICE_ID, { name, userName }))
