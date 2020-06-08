import { PublicKeyset } from '/keyset'

export interface Member {
  userName: string
  keys: PublicKeyset
  roles?: string[]

  /** All the member's keysets over their history of key rotation.
   * The index of the keyset in the array corresponds to the
   * key generation: previousKeys[0] is generation 0, etc.
   */
  keyHistory?: PublicKeyset[]
}
