import stringify from 'json-stable-stringify'
import { Payload } from '/util/types'
import { utf8 } from '/util/utf8'

/** Takes either a string, a byte array, or a javascript object, and returns it as a byte array */
export const payloadToBytes = (x: Payload): Uint8Array =>
  typeof x === 'string'
    ? // string
      utf8.encode(x)
    : ArrayBuffer.isView(x)
    ? // byte array
      x
    : // object
      utf8.encode(stringify(x))
