import { Key, Payload } from '/lib'

export interface Invitation {
  /** Randomly generated secret that Alice sends to Bob via a pre-authenticated channel */
  key: Key

  /** Public, unique identifier for the invitation */
  id: Key

  /** Body contains Bob's username and a public signature key, symmetrically encrypted using the team key */
  body: Payload

  /** Generation # of the team keyset */
  generation: number
}
