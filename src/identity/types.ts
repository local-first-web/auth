import { KeyScope } from '/keyset'
import { Base64, UnixTimestamp } from '/util'

export type Challenge = KeyScope & {
  nonce: Base64
  timestamp: UnixTimestamp
}
