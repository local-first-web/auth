import * as utf8 from '@stablelib/utf8'
import { Payload } from 'lib/types'
// import msgpack from 'msgpack-lite'
import stringify from 'json-stable-stringify'

export const payloadToBytes = (x: Payload) =>
  typeof x === 'string'
    ? utf8.encode(x) // string
    : ArrayBuffer.isView(x)
    ? x // byte array
    : utf8.encode(stringify(x)) // object
