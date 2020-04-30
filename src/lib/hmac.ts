import { createHmac } from 'isomorphic-crypto'
import { Key, Payload } from 'types'
import { keyToBytes } from './keyToBytes'
import { payloadToBytes } from './payloadToBytes'

export const hmac = (key: Key, payload: Payload) => {
  const keyBytes = keyToBytes(key, 'utf8')
  const hmac = createHmac('sha512', keyBytes)

  const payloadBytes = payloadToBytes(payload)
  return hmac.update(payloadBytes).digest()
}
