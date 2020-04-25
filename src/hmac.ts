import msgpack from 'msgpack-lite'
import * as utf8 from '@stablelib/utf8'
import { createHmac } from 'isomorphic-crypto'

export const hmac = (
  key: string | Uint8Array,
  payload: string | Uint8Array | object
) => {
  const keyBytes = typeof key === 'string' ? utf8.encode(key) : key
  const hmac = createHmac('sha512', keyBytes)

  const payloadBytes =
    typeof payload === 'string'
      ? utf8.encode(payload) // string to bytes
      : payload instanceof Uint8Array
      ? payload // bytes
      : msgpack.encode(payload) // json object to bytes
  return hmac.update(payloadBytes).digest()
}
