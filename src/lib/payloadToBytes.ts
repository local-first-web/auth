import * as utf8 from '@stablelib/utf8'
import { Payload } from 'lib/types'
import msgpack from 'msgpack-lite'

export const payloadToBytes = (x: Payload) =>
  typeof x === 'string'
    ? utf8.encode(x) // string
    : ArrayBuffer.isView(x)
    ? x // Uint8Array
    : msgpack.encode(x) // object
