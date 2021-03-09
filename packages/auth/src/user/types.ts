import { DeviceWithSecrets } from '@/device'
import { KeysetWithSecrets } from '@/keyset'

/** The local user and their full set of keys, including secrets.   */
export interface User {
  /** Username (or ID or email) */
  userName: string

  /** The user's most recent keys, including their secrets. */
  keys: KeysetWithSecrets

  /** All the user's keysets over their history of key rotation.
   *  The index of the keyset in the array corresponds to the
   *  key generation: previousKeys[0] is generation 0, etc. */
  keyHistory?: KeysetWithSecrets[]
}
