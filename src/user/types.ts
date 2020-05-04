import { PublicKeyset, KeysetWithSecrets } from '../keys'

/** A user and their full set of keys, including secrets. SHOULD NEVER LEAVE THE LOCAL USER'S DEVICE.  */
export interface UserWithSecrets {
  /** Username (or ID or email) */
  name: string

  /** The user's keys, including their secrets. */
  keys: KeysetWithSecrets
}

/** A user and their public keys.  */
export interface User {
  /** Username (or ID or email) */
  name: string

  /** The user's public keys */
  keys: PublicKeyset
}
