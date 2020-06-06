import { PublicKeys } from '/keys'

export interface Member {
  userName: string
  keys: PublicKeys
  roles?: string[]

  /** All the member's keysets over their history of key rotation.
   * The index of the keyset in the array corresponds to the
   * key generation: previousKeys[0] is generation 0, etc.
   */
  keyHistory?: PublicKeys[]
}
