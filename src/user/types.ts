import { PublicKeys, KeysWithSecrets, KeysetHistory } from '/keys'
import { Device } from '/context'

/** A user and their full set of keys, including secrets.   */
export interface UserWithSecrets {
  /** Username (or ID or email) */
  userName: string

  /** The user's most recent keys, including their secrets. */
  keys: KeysWithSecrets

  /** All the user's keysets over their history of key rotation.
   * The index of the keyset in the array corresponds to the
   * key generation: previousKeys[0] is generation 0, etc.
   */
  keysetHistory?: KeysetHistory

  devices?: Device[]
}

/** A user and their public keys.  */
export interface User {
  /** Username (or ID or email) */
  userName: string

  /** The user's public keys */
  keys: PublicKeys
}
