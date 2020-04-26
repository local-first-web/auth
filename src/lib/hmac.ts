import msgpack from 'msgpack-lite'
import * as utf8 from '@stablelib/utf8'
import { createHmac } from 'isomorphic-crypto'
import { Message } from 'types'

export const hmac = (key: Message, payload: Message | object) => {
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
